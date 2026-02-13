"""Flask API configuration."""

import sys
from pathlib import Path

from pydantic import BaseModel

# Add scripts to path so prediction modules are importable
SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))


class APIConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
