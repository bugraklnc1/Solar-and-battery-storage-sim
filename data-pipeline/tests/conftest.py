"""
Adds the data-pipeline/ root directory to sys.path so that test files
inside tests/ can import modules like clean_data and models directly.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
