from pydantic import BaseModel


class UpdateCreditRequest(BaseModel):
    credit_balance: int


class UpdateFeedbackStatusRequest(BaseModel):
    status: str


class UpdatePlanRequest(BaseModel):
    plan: str  # 'free' | 'lite' | 'pro'
