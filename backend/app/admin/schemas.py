from pydantic import BaseModel


class UpdateCreditRequest(BaseModel):
    credit_balance: int
