"""API entrypoint."""

import sys
from pathlib import Path

# Ensure scripts/ is in path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from api.app import create_app
from api.config import APIConfig

if __name__ == "__main__":
    config = APIConfig()
    app = create_app(config)
    app.run(host=config.host, port=config.port, debug=config.debug)
