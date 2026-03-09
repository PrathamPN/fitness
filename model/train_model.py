"""
train_model.py
==============
Trains a TensorFlow / Keras binary classifier on the extracted
bicep curl landmark features (good=1, bad=0).

Input : model/bicep_curl_landmarks.csv
Output: model/bicep_curl_model/   (Keras SavedModel format)
"""

import os
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing    import StandardScaler
from sklearn.metrics          import classification_report, confusion_matrix
import joblib   # to save the scaler

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV   = os.path.join(BASE_DIR, "bicep_curl_landmarks.csv")
MODEL_DIR   = os.path.join(BASE_DIR, "bicep_curl_model")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.save")

FEATURE_NAMES = [
    "elbow_angle",
    "elbow_hip_dist",
    "wrist_above_shoulder",
    "shoulder_angle",
    "wrist_elbow_x",
    "elbow_rise",
    "torso_lean",
    "elbow_visibility",
]

SEED = 42
tf.random.set_seed(SEED)
np.random.seed(SEED)

# ─── 1. Load data ─────────────────────────────────────────────────────────────
print("Loading dataset...")
df = pd.read_csv(INPUT_CSV)
print(f"  Total samples : {len(df)}")
print(f"  Class balance :")
print(df["label"].value_counts().rename({1: "good", 0: "bad"}).to_string())

X = df[FEATURE_NAMES].values.astype(np.float32)
y = df["label"].values.astype(np.float32)

# ─── 2. Train / val / test split ──────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=SEED, stratify=y)
X_train, X_val, y_train, y_val   = train_test_split(X_train, y_train, test_size=0.15, random_state=SEED, stratify=y_train)

print(f"\n  Train : {len(X_train)} | Val : {len(X_val)} | Test : {len(X_test)}")

# ─── 3. Feature scaling ───────────────────────────────────────────────────────
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_val   = scaler.transform(X_val)
X_test  = scaler.transform(X_test)

# Save scaler (also export to JSON for in-browser use)
joblib.dump(scaler, SCALER_PATH)
print(f"\n  Scaler saved → {SCALER_PATH}")

# Export scaler params as JSON so the web app can normalise on the fly
import json
scaler_json_path = os.path.join(BASE_DIR, "scaler_params.json")
scaler_params = {
    "mean": scaler.mean_.tolist(),
    "scale": scaler.scale_.tolist(),
    "feature_names": FEATURE_NAMES,
}
with open(scaler_json_path, "w") as f:
    json.dump(scaler_params, f, indent=2)
print(f"  Scaler JSON  → {scaler_json_path}")

# ─── 4. Build model ───────────────────────────────────────────────────────────
n_features = X_train.shape[1]

model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(n_features,), name="features"),
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(32, activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(16, activation="relu"),
    tf.keras.layers.Dense(1, activation="sigmoid", name="good_form_probability"),
], name="bicep_curl_classifier")

model.summary()

# ─── 5. Compile ───────────────────────────────────────────────────────────────
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="binary_crossentropy",
    metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
)

# ─── 6. Train ─────────────────────────────────────────────────────────────────
callbacks = [
    tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True, monitor="val_auc", mode="max"),
    tf.keras.callbacks.ReduceLROnPlateau(patience=5, factor=0.5, monitor="val_loss"),
]

print("\nTraining...")
history = model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=30,
    batch_size=64,
    callbacks=callbacks,
    verbose=1,
)

# ─── 7. Evaluate ──────────────────────────────────────────────────────────────
print("\n─── Test Set Evaluation ───")
loss, acc, auc = model.evaluate(X_test, y_test, verbose=0)
print(f"  Loss     : {loss:.4f}")
print(f"  Accuracy : {acc:.4f}  ({acc*100:.1f}%)")
print(f"  AUC      : {auc:.4f}")

y_pred = (model.predict(X_test, verbose=0) > 0.5).astype(int).flatten()
print("\n  Classification Report:")
print(classification_report(y_test, y_pred, target_names=["bad", "good"]))
print("  Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# ─── 8. Save model ────────────────────────────────────────────────────────────
model.save(MODEL_DIR + ".h5")
print(f"\n✅ Model saved → {MODEL_DIR}.h5")
print("   Next step: run  python convert_to_tfjs.py")
