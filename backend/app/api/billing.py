"""
Payment & Billing API endpoints for CloneAI platform
Handles subscription management, payment processing, invoicing, and credit system
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

import structlog

from app.database import get_db_session, get_supabase
from app.core.supabase_auth import get_current_user_id, require_role
from app.models.database import UserProfile, Session, Clone
from app.models.schemas import BaseSchema

logger = structlog.get_logger()

router = APIRouter(prefix="/billing", tags=["Payment & Billing"])


# Billing Schemas
class SubscriptionPlan(BaseSchema):
    """Subscription plan details"""
    plan_id: str
    name: str
    description: str
    price_monthly: float
    price_yearly: float
    credits_per_month: int
    features: List[str]
    max_clones: int
    priority_support: bool
    api_access: bool


class SubscriptionResponse(BaseSchema):
    """User subscription response"""
    user_id: str
    plan_id: str
    plan_name: str
    status: str  # active, cancelled, past_due, trialing
    current_period_start: datetime
    current_period_end: datetime
    credits_remaining: int
    credits_total: int
    auto_renew: bool
    billing_cycle: str  # monthly, yearly
    next_billing_date: Optional[datetime]
    payment_method: Optional[Dict[str, Any]]


class PaymentMethodCreate(BaseSchema):
    """Create payment method"""
    type: str  # card, paypal, bank_transfer
    card_number: Optional[str] = None  # Last 4 digits for display
    card_brand: Optional[str] = None  # visa, mastercard, etc.
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    billing_address: Optional[Dict[str, Any]] = None
    is_default: bool = True


class PaymentMethodResponse(BaseSchema):
    """Payment method response"""
    id: str
    user_id: str
    type: str
    card_last4: Optional[str]
    card_brand: Optional[str]
    exp_month: Optional[int]
    exp_year: Optional[int]
    is_default: bool
    is_valid: bool
    created_at: datetime


class InvoiceLineItem(BaseSchema):
    """Invoice line item"""
    description: str
    quantity: int
    unit_price: float
    total_price: float
    clone_id: Optional[str] = None
    session_id: Optional[str] = None


class InvoiceResponse(BaseSchema):
    """Invoice response"""
    id: str
    user_id: str
    invoice_number: str
    status: str  # draft, sent, paid, overdue, cancelled
    subtotal: float
    tax_amount: float
    total_amount: float
    currency: str
    billing_period_start: datetime
    billing_period_end: datetime
    issue_date: datetime
    due_date: datetime
    paid_date: Optional[datetime]
    payment_method_id: Optional[str]
    line_items: List[InvoiceLineItem]
    download_url: Optional[str]


class CreditTransactionResponse(BaseSchema):
    """Credit transaction response"""
    id: str
    user_id: str
    transaction_type: str  # purchase, usage, refund, bonus
    amount: int
    description: str
    session_id: Optional[str]
    clone_id: Optional[str]
    created_at: datetime
    expires_at: Optional[datetime]


class BillingHistoryResponse(BaseSchema):
    """Billing history response"""
    invoices: List[InvoiceResponse]
    credit_transactions: List[CreditTransactionResponse]
    total_spent: float
    credits_purchased: int
    credits_used: int
    current_balance: int


class SubscriptionChangeRequest(BaseSchema):
    """Subscription change request"""
    new_plan_id: str
    billing_cycle: str = "monthly"  # monthly, yearly
    prorate: bool = True
    effective_date: Optional[datetime] = None


class PaymentRequest(BaseSchema):
    """Payment processing request"""
    amount: float
    currency: str = "USD"
    payment_method_id: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = {}


class PaymentResponse(BaseSchema):
    """Payment processing response"""
    payment_id: str
    status: str  # succeeded, failed, pending, requires_action
    amount: float
    currency: str
    client_secret: Optional[str]  # For frontend payment confirmation
    error_message: Optional[str]
    created_at: datetime


# Subscription Management Endpoints
@router.get("/plans", response_model=List[SubscriptionPlan])
async def get_subscription_plans() -> List[SubscriptionPlan]:
    """
    Get all available subscription plans
    Public endpoint - no authentication required
    """
    try:
        # In a real implementation, these would be stored in database
        plans = [
            SubscriptionPlan(
                plan_id="free",
                name="Free",
                description="Perfect for trying out CloneAI",
                price_monthly=0.0,
                price_yearly=0.0,
                credits_per_month=100,
                features=[
                    "Up to 100 credits per month",
                    "Access to public clones",
                    "Basic chat functionality",
                    "Community support"
                ],
                max_clones=0,
                priority_support=False,
                api_access=False
            ),
            SubscriptionPlan(
                plan_id="pro",
                name="Pro",
                description="For creators and power users",
                price_monthly=29.99,
                price_yearly=299.99,
                credits_per_month=2000,
                features=[
                    "2,000 credits per month",
                    "Create up to 5 AI clones",
                    "Advanced customization",
                    "Priority support",
                    "Analytics dashboard",
                    "Export conversations"
                ],
                max_clones=5,
                priority_support=True,
                api_access=True
            ),
            SubscriptionPlan(
                plan_id="enterprise",
                name="Enterprise",
                description="For teams and organizations",
                price_monthly=99.99,
                price_yearly=999.99,
                credits_per_month=10000,
                features=[
                    "10,000 credits per month",
                    "Unlimited AI clones",
                    "Advanced integrations",
                    "Dedicated support",
                    "Custom branding",
                    "SSO integration",
                    "Advanced analytics",
                    "API access"
                ],
                max_clones=-1,  # Unlimited
                priority_support=True,
                api_access=True
            )
        ]
        
        return plans
        
    except Exception as e:
        logger.error("Failed to get subscription plans", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription plans"
        )


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_user_subscription(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> SubscriptionResponse:
    """
    Get current user's subscription details
    """
    try:
        # Get user profile
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # For now, we'll simulate subscription data based on user's tier
        # In a real implementation, this would come from a subscriptions table
        
        current_time = datetime.utcnow()
        
        if user.subscription_tier == "free":
            plan_name = "Free"
            next_billing = None
        elif user.subscription_tier == "pro":
            plan_name = "Pro"
            next_billing = current_time + timedelta(days=30)
        else:  # enterprise
            plan_name = "Enterprise"
            next_billing = current_time + timedelta(days=30)
        
        return SubscriptionResponse(
            user_id=current_user_id,
            plan_id=user.subscription_tier,
            plan_name=plan_name,
            status="active",
            current_period_start=current_time - timedelta(days=15),
            current_period_end=current_time + timedelta(days=15),
            credits_remaining=user.credits_remaining,
            credits_total=2000 if user.subscription_tier == "pro" else 10000 if user.subscription_tier == "enterprise" else 100,
            auto_renew=True,
            billing_cycle="monthly",
            next_billing_date=next_billing,
            payment_method={"type": "card", "last4": "4242"} if user.subscription_tier != "free" else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user subscription", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription"
        )


@router.post("/subscription/change")
async def change_subscription(
    subscription_change: SubscriptionChangeRequest,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Change user's subscription plan
    """
    try:
        # Verify user exists
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Validate new plan
        valid_plans = ["free", "pro", "enterprise"]
        if subscription_change.new_plan_id not in valid_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid subscription plan"
            )
        
        # Check if user is downgrading and has too many clones
        if subscription_change.new_plan_id == "free":
            clones_count_result = await db.execute(
                select(func.count(Clone.id)).where(Clone.creator_id == current_user_id)
            )
            clones_count = clones_count_result.scalar()
            
            if clones_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot downgrade to free plan while having clones. Please delete your clones first."
                )
        
        elif subscription_change.new_plan_id == "pro":
            clones_count_result = await db.execute(
                select(func.count(Clone.id)).where(Clone.creator_id == current_user_id)
            )
            clones_count = clones_count_result.scalar()
            
            if clones_count > 5:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot downgrade to pro plan while having more than 5 clones. Please delete some clones first."
                )
        
        # Update user subscription
        user.subscription_tier = subscription_change.new_plan_id
        
        # Update credits based on new plan
        if subscription_change.new_plan_id == "free":
            user.credits_remaining = 100
        elif subscription_change.new_plan_id == "pro":
            user.credits_remaining = 2000
        else:  # enterprise
            user.credits_remaining = 10000
        
        await db.commit()
        
        # Queue background tasks for subscription change
        # background_tasks.add_task(send_subscription_change_email, current_user_id, subscription_change.new_plan_id)
        # background_tasks.add_task(update_payment_provider, current_user_id, subscription_change)
        
        logger.info("Subscription changed successfully", 
                   user_id=current_user_id, 
                   new_plan=subscription_change.new_plan_id)
        
        return {
            "message": "Subscription changed successfully",
            "new_plan": subscription_change.new_plan_id,
            "effective_date": datetime.utcnow().isoformat(),
            "credits_updated": user.credits_remaining
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to change subscription", 
                    error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change subscription"
        )


@router.post("/subscription/cancel")
async def cancel_subscription(
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Cancel user's subscription (will remain active until end of billing period)
    """
    try:
        # Verify user exists and has active subscription
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.subscription_tier == "free":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active subscription to cancel"
            )
        
        # In a real implementation, we would:
        # 1. Mark subscription as cancelled in payment provider
        # 2. Set cancellation date
        # 3. Keep subscription active until end of current period
        
        # Queue background tasks
        # background_tasks.add_task(cancel_subscription_provider, current_user_id)
        # background_tasks.add_task(send_cancellation_email, current_user_id)
        
        logger.info("Subscription cancelled", user_id=current_user_id)
        
        return {
            "message": "Subscription cancelled successfully",
            "status": "cancelled",
            "remains_active_until": (datetime.utcnow() + timedelta(days=15)).isoformat(),
            "downgrade_date": (datetime.utcnow() + timedelta(days=15)).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel subscription", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )


# Payment Methods Management
@router.get("/payment-methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[PaymentMethodResponse]:
    """
    Get user's saved payment methods
    """
    try:
        # In a real implementation, this would query payment methods from database
        # For now, return mock data
        
        payment_methods = [
            PaymentMethodResponse(
                id="pm_1",
                user_id=current_user_id,
                type="card",
                card_last4="4242",
                card_brand="visa",
                exp_month=12,
                exp_year=2025,
                is_default=True,
                is_valid=True,
                created_at=datetime.utcnow() - timedelta(days=30)
            )
        ]
        
        return payment_methods
        
    except Exception as e:
        logger.error("Failed to get payment methods", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment methods"
        )


@router.post("/payment-methods", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
async def add_payment_method(
    payment_method: PaymentMethodCreate,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> PaymentMethodResponse:
    """
    Add a new payment method
    """
    try:
        # In a real implementation, this would:
        # 1. Validate payment method with payment provider
        # 2. Store payment method securely
        # 3. Return payment method details
        
        # Mock payment method creation
        new_payment_method = PaymentMethodResponse(
            id=f"pm_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            user_id=current_user_id,
            type=payment_method.type,
            card_last4=payment_method.card_number[-4:] if payment_method.card_number else None,
            card_brand=payment_method.card_brand,
            exp_month=payment_method.exp_month,
            exp_year=payment_method.exp_year,
            is_default=payment_method.is_default,
            is_valid=True,
            created_at=datetime.utcnow()
        )
        
        # Queue background tasks
        # background_tasks.add_task(validate_payment_method, new_payment_method.id)
        # background_tasks.add_task(send_payment_method_added_email, current_user_id)
        
        logger.info("Payment method added", 
                   user_id=current_user_id, 
                   payment_method_id=new_payment_method.id)
        
        return new_payment_method
        
    except Exception as e:
        logger.error("Failed to add payment method", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add payment method"
        )


@router.delete("/payment-methods/{payment_method_id}")
async def delete_payment_method(
    payment_method_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Delete a payment method
    """
    try:
        # In a real implementation, this would:
        # 1. Verify payment method belongs to user
        # 2. Check if it's being used for active subscriptions
        # 3. Delete from payment provider
        # 4. Remove from database
        
        logger.info("Payment method deleted", 
                   user_id=current_user_id, 
                   payment_method_id=payment_method_id)
        
        return {
            "message": "Payment method deleted successfully",
            "payment_method_id": payment_method_id
        }
        
    except Exception as e:
        logger.error("Failed to delete payment method", 
                    error=str(e), user_id=current_user_id, payment_method_id=payment_method_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete payment method"
        )


# Invoice Management
@router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None, description="Filter by invoice status"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[InvoiceResponse]:
    """
    Get user's invoices with pagination
    """
    try:
        # In a real implementation, this would query invoices from database
        # For now, return mock data
        
        mock_invoices = [
            InvoiceResponse(
                id="inv_1",
                user_id=current_user_id,
                invoice_number="INV-2024-001",
                status="paid",
                subtotal=29.99,
                tax_amount=2.40,
                total_amount=32.39,
                currency="USD",
                billing_period_start=datetime.utcnow() - timedelta(days=30),
                billing_period_end=datetime.utcnow(),
                issue_date=datetime.utcnow() - timedelta(days=5),
                due_date=datetime.utcnow() + timedelta(days=10),
                paid_date=datetime.utcnow() - timedelta(days=3),
                payment_method_id="pm_1",
                line_items=[
                    InvoiceLineItem(
                        description="Pro Plan - Monthly Subscription",
                        quantity=1,
                        unit_price=29.99,
                        total_price=29.99
                    )
                ],
                download_url="/api/v1/billing/invoices/inv_1/download"
            )
        ]
        
        # Apply status filter if provided
        if status:
            mock_invoices = [inv for inv in mock_invoices if inv.status == status]
        
        # Apply pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_invoices = mock_invoices[start_idx:end_idx]
        
        return paginated_invoices
        
    except Exception as e:
        logger.error("Failed to get invoices", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve invoices"
        )


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> InvoiceResponse:
    """
    Get specific invoice details
    """
    try:
        # In a real implementation, verify invoice belongs to user
        # For now, return mock data
        
        mock_invoice = InvoiceResponse(
            id=invoice_id,
            user_id=current_user_id,
            invoice_number=f"INV-2024-{invoice_id[-3:]}",
            status="paid",
            subtotal=29.99,
            tax_amount=2.40,
            total_amount=32.39,
            currency="USD",
            billing_period_start=datetime.utcnow() - timedelta(days=30),
            billing_period_end=datetime.utcnow(),
            issue_date=datetime.utcnow() - timedelta(days=5),
            due_date=datetime.utcnow() + timedelta(days=10),
            paid_date=datetime.utcnow() - timedelta(days=3),
            payment_method_id="pm_1",
            line_items=[
                InvoiceLineItem(
                    description="Pro Plan - Monthly Subscription",
                    quantity=1,
                    unit_price=29.99,
                    total_price=29.99
                )
            ],
            download_url=f"/api/v1/billing/invoices/{invoice_id}/download"
        )
        
        return mock_invoice
        
    except Exception as e:
        logger.error("Failed to get invoice", 
                    error=str(e), user_id=current_user_id, invoice_id=invoice_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve invoice"
        )


# Credit System
@router.get("/credits/balance")
async def get_credit_balance(
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get user's current credit balance
    """
    try:
        # Get user profile
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {
            "user_id": current_user_id,
            "credits_remaining": user.credits_remaining,
            "subscription_tier": user.subscription_tier,
            "monthly_allowance": 100 if user.subscription_tier == "free" else 2000 if user.subscription_tier == "pro" else 10000,
            "next_renewal": (datetime.utcnow() + timedelta(days=30)).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get credit balance", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve credit balance"
        )


@router.post("/credits/purchase")
async def purchase_credits(
    payment_request: PaymentRequest,
    background_tasks: BackgroundTasks,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Purchase additional credits
    """
    try:
        # Validate purchase amount
        if payment_request.amount < 5.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum purchase amount is $5.00"
            )
        
        if payment_request.amount > 1000.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum purchase amount is $1000.00"
            )
        
        # Calculate credits (e.g., $1 = 100 credits)
        credits_to_add = int(payment_request.amount * 100)
        
        # Process payment (placeholder)
        payment_response = PaymentResponse(
            payment_id=f"pay_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            status="succeeded",
            amount=payment_request.amount,
            currency=payment_request.currency,
            client_secret=None,
            error_message=None,
            created_at=datetime.utcnow()
        )
        
        if payment_response.status == "succeeded":
            # Update user credits
            user_result = await db.execute(
                select(UserProfile).where(UserProfile.id == current_user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                user.credits_remaining += credits_to_add
                await db.commit()
                
                # Queue background tasks
                # background_tasks.add_task(send_purchase_confirmation_email, current_user_id, credits_to_add)
                # background_tasks.add_task(create_credit_transaction_record, current_user_id, payment_response)
                
                logger.info("Credits purchased successfully", 
                           user_id=current_user_id, 
                           credits_added=credits_to_add,
                           payment_id=payment_response.payment_id)
        
        return {
            "payment": payment_response,
            "credits_added": credits_to_add,
            "new_balance": user.credits_remaining if payment_response.status == "succeeded" else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to purchase credits", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process credit purchase"
        )


@router.get("/credits/transactions", response_model=List[CreditTransactionResponse])
async def get_credit_transactions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    transaction_type: Optional[str] = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> List[CreditTransactionResponse]:
    """
    Get user's credit transaction history
    """
    try:
        # In a real implementation, this would query credit transactions from database
        # For now, return mock data
        
        mock_transactions = [
            CreditTransactionResponse(
                id="ct_1",
                user_id=current_user_id,
                transaction_type="purchase",
                amount=1000,
                description="Credit purchase - $10.00",
                session_id=None,
                clone_id=None,
                created_at=datetime.utcnow() - timedelta(days=5),
                expires_at=None
            ),
            CreditTransactionResponse(
                id="ct_2",
                user_id=current_user_id,
                transaction_type="usage",
                amount=-50,
                description="Chat session with Business Coach",
                session_id="session_123",
                clone_id="clone_456",
                created_at=datetime.utcnow() - timedelta(days=2),
                expires_at=None
            )
        ]
        
        # Apply type filter if provided
        if transaction_type:
            mock_transactions = [tx for tx in mock_transactions if tx.transaction_type == transaction_type]
        
        # Apply pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_transactions = mock_transactions[start_idx:end_idx]
        
        return paginated_transactions
        
    except Exception as e:
        logger.error("Failed to get credit transactions", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve credit transactions"
        )


# Billing History
@router.get("/history", response_model=BillingHistoryResponse)
async def get_billing_history(
    months: int = Query(default=12, ge=1, le=24, description="Number of months of history"),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> BillingHistoryResponse:
    """
    Get comprehensive billing history for user
    """
    try:
        # Get invoices (placeholder)
        invoices = await get_invoices(page=1, limit=100, current_user_id=current_user_id, db=db)
        
        # Get credit transactions (placeholder)
        credit_transactions = await get_credit_transactions(page=1, limit=100, current_user_id=current_user_id, db=db)
        
        # Calculate totals
        total_spent = sum(inv.total_amount for inv in invoices if inv.status == "paid")
        credits_purchased = sum(tx.amount for tx in credit_transactions if tx.transaction_type == "purchase" and tx.amount > 0)
        credits_used = abs(sum(tx.amount for tx in credit_transactions if tx.transaction_type == "usage" and tx.amount < 0))
        
        # Get current balance
        user_result = await db.execute(
            select(UserProfile).where(UserProfile.id == current_user_id)
        )
        user = user_result.scalar_one_or_none()
        current_balance = user.credits_remaining if user else 0
        
        return BillingHistoryResponse(
            invoices=invoices,
            credit_transactions=credit_transactions,
            total_spent=total_spent,
            credits_purchased=credits_purchased,
            credits_used=credits_used,
            current_balance=current_balance
        )
        
    except Exception as e:
        logger.error("Failed to get billing history", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve billing history"
        )


# Webhooks (for payment provider callbacks)
@router.post("/webhooks/payment")
async def payment_webhook(
    request: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Handle payment provider webhooks
    This endpoint should be secured with webhook signature validation
    """
    try:
        # In a real implementation, this would:
        # 1. Verify webhook signature
        # 2. Process various webhook events (payment succeeded, failed, subscription updated, etc.)
        # 3. Update user records accordingly
        
        event_type = request.get("type")
        event_data = request.get("data", {})
        
        logger.info("Payment webhook received", event_type=event_type)
        
        if event_type == "payment.succeeded":
            # Handle successful payment
            pass
        elif event_type == "payment.failed":
            # Handle failed payment
            pass
        elif event_type == "subscription.updated":
            # Handle subscription changes
            pass
        elif event_type == "invoice.payment_succeeded":
            # Handle invoice payments
            pass
        
        return {"received": True}
        
    except Exception as e:
        logger.error("Failed to process payment webhook", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook"
        )


# Admin Endpoints (Revenue Management)
@router.get("/admin/revenue-summary")
async def get_revenue_summary(
    days: int = Query(default=30, ge=1, le=365),
    current_user_id: str = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get revenue summary for admin dashboard
    Requires admin role
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get total revenue from sessions
        total_revenue_result = await db.execute(
            select(func.sum(Session.total_cost))
            .where(Session.start_time >= start_date)
        )
        total_revenue = float(total_revenue_result.scalar() or 0)
        
        # Get revenue by subscription tier
        revenue_by_tier_result = await db.execute(
            select(UserProfile.subscription_tier, func.sum(Session.total_cost))
            .join(Session, UserProfile.id == Session.user_id)
            .where(Session.start_time >= start_date)
            .group_by(UserProfile.subscription_tier)
        )
        
        revenue_by_tier = {
            row.subscription_tier: float(row[1])
            for row in revenue_by_tier_result
        }
        
        # Get user counts by tier
        user_counts_result = await db.execute(
            select(UserProfile.subscription_tier, func.count(UserProfile.id))
            .group_by(UserProfile.subscription_tier)
        )
        
        user_counts = {
            row.subscription_tier: row[1]
            for row in user_counts_result
        }
        
        return {
            "period_days": days,
            "total_revenue": total_revenue,
            "revenue_by_tier": revenue_by_tier,
            "user_counts_by_tier": user_counts,
            "average_revenue_per_user": total_revenue / sum(user_counts.values()) if sum(user_counts.values()) > 0 else 0,
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Failed to get revenue summary", error=str(e), user_id=current_user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve revenue summary"
        )