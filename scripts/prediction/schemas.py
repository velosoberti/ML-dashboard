"""Request/Response schemas for prediction API."""

from pydantic import BaseModel, Field


class PredictionInput(BaseModel):
    """Validated input for a single patient prediction."""

    Pregnancies: int = Field(ge=0, le=20)
    Glucose: float = Field(ge=0, le=250)
    BloodPressure: float = Field(ge=0, le=200)
    SkinThickness: float = Field(ge=0, le=120)
    Insulin: float = Field(ge=0, le=900)
    BMI: float = Field(ge=0, le=80)
    DiabetesPedigreeFunction: float = Field(ge=0.0, le=3.0)
    Age: int = Field(ge=18, le=100)


class PredictionOutput(BaseModel):
    """Prediction result for a single patient."""

    prediction: int = Field(description="0=No Diabetes, 1=Diabetes")
    probability: float = Field(ge=0.0, le=1.0, description="Probability of diabetes")
    model_name: str


class BatchPredictionInput(BaseModel):
    """Multiple patients at once."""

    patients: list[PredictionInput]


class BatchPredictionOutput(BaseModel):
    """Results for multiple patients."""

    predictions: list[PredictionOutput]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str | None = None
