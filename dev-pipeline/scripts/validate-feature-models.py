#!/usr/bin/env python3
"""Validate model fields in feature-list.json against available-models.json."""

import argparse
import json
import os
import sys


def validate_feature(feature, models_data):
    """Check a single feature's model field and print warnings if needed."""
    feature_id = feature.get("id", "unknown")
    model = feature.get("model")
    if not model:
        return

    model_switch_supported = models_data.get("model_switch_supported", True)
    cli = models_data.get("cli", "unknown")
    available_models = models_data.get("models", [])

    if not model_switch_supported:
        print(
            f"\u26a0 {feature_id}: CLI '{cli}' does not support --model switching "
            f"(model field '{model}' will be ignored)"
        )
    elif available_models and model not in available_models:
        print(f"\u26a0 {feature_id}: Model '{model}' not in available models list")


def main():
    parser = argparse.ArgumentParser(
        description="Validate model fields in feature-list.json against available-models.json"
    )
    parser.add_argument("--feature-list", required=True, help="Path to feature-list.json")
    parser.add_argument("--models-file", required=True, help="Path to available-models.json")
    args = parser.parse_args()

    if not os.path.exists(args.models_file):
        sys.exit(0)

    with open(args.feature_list) as f:
        feature_data = json.load(f)

    with open(args.models_file) as f:
        models_data = json.load(f)

    features = feature_data if isinstance(feature_data, list) else feature_data.get("features", [])

    for feature in features:
        validate_feature(feature, models_data)
        for sub in feature.get("sub_features", []):
            validate_feature(sub, models_data)


if __name__ == "__main__":
    main()
