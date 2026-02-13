"""Pydantic schemas for validating data from the feature store."""

from pydantic import BaseModel, Field


class PatientFeatures(BaseModel):
    """Validates a single row from the Feast offline store."""

    model_config = {"from_attributes": True}

    Pregnancies: int = Field(ge=0, le=20)
    Glucose: float = Field(ge=0, le=250)
    BloodPressure: float = Field(ge=0, le=200)
    SkinThickness: float = Field(ge=0, le=120)
    Insulin: float = Field(ge=0, le=900)
    BMI: float = Field(ge=0, le=80)
    DiabetesPedigreeFunction: float = Field(ge=0.0, le=3.0)
    Age: int = Field(ge=18, le=100)
    Outcome: int = Field(ge=0, le=1)
