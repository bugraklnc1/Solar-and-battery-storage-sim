"""
Step 4: Pydantic data contract model.

HourlyRecord guarantees that every record in solar_data.json is valid.
Matches the TypeScript HourlyRecord interface exactly (project.md §5).
"""

from typing import Literal

from pydantic import BaseModel, Field


class HourlyRecord(BaseModel):
    """
    A single hourly meteorological + location record.

    Constraints (project.md §10):
      - location            : only the three supported cities
      - temperature_2m      : between -50 and 60 °C
      - shortwave_radiation : cannot be negative (W/m²)
    """

    timestamp: str
    location: Literal["Berlin", "Madrid", "Lisbon"]
    temperature_2m: float = Field(ge=-50.0, le=60.0)
    shortwave_radiation: float = Field(ge=0.0)
