"""
convert_to_tfjs.py
==================
Converts the trained Keras SavedModel to TensorFlow.js LayersModel format
so it can be loaded directly in the browser with tf.loadLayersModel().

Input : model/bicep_curl_model/   (Keras SavedModel)
Output: model/tfjs_model/         (model.json + weight shards)
"""

import os
import subprocess
import sys

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR   = os.path.join(BASE_DIR, "bicep_curl_model.h5")
TFJS_DIR    = os.path.join(BASE_DIR, "tfjs_model")

def main():
    if not os.path.exists(MODEL_DIR):
        print(f"[ERROR] Trained model not found at: {MODEL_DIR}")
        print("  Please run  train_model.py  first.")
        sys.exit(1)

    os.makedirs(TFJS_DIR, exist_ok=True)

    print(f"Converting  {MODEL_DIR}  →  {TFJS_DIR} ...")
    result = subprocess.run(
        [
            sys.executable, "-m", "tensorflowjs.converters.converter",
            "--input_format",  "keras",
            "--output_format", "tfjs_layers_model",
            MODEL_DIR,
            TFJS_DIR,
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        # Fallback: try tensorflowjs_converter CLI
        print("Trying alternative converter command...")
        result2 = subprocess.run(
            [
                "tensorflowjs_converter",
                "--input_format",  "keras",
                "--output_format", "tfjs_layers_model",
                MODEL_DIR,
                TFJS_DIR,
            ],
            capture_output=True,
            text=True,
        )
        if result2.returncode != 0:
            print("[ERROR] Conversion failed.")
            print(result.stderr)
            print(result2.stderr)
            sys.exit(1)
        else:
            print(result2.stdout)
    else:
        print(result.stdout)

    # Verify output
    model_json = os.path.join(TFJS_DIR, "model.json")
    if os.path.exists(model_json):
        print(f"\n✅ TF.js model written to: {TFJS_DIR}")
        print(f"   Files:")
        for f in os.listdir(TFJS_DIR):
            fpath = os.path.join(TFJS_DIR, f)
            print(f"     {f}  ({os.path.getsize(fpath):,} bytes)")
        print("\n   Next step:")
        print("   1. Copy  model/tfjs_model/  into  AI-Fitness-Coach/public/model/  (or serve via Vite)")
        print("   2. Copy  model/scaler_params.json  into  AI-Fitness-Coach/public/model/")
        print("   3. The web app will load the model automatically for Bicep Curl form analysis.")
    else:
        print("[ERROR] model.json not found after conversion.")
        sys.exit(1)


if __name__ == "__main__":
    main()
