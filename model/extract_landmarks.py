"""
extract_landmarks.py
====================
Extracts MediaPipe Pose landmarks from bicep curl training videos
and saves them as a CSV dataset for model training.
Uses the modern MediaPipe Tasks API (PoseLandmarker).

Dataset folder structure expected:
  dataset/training_data/good/*.mp4  → label = 1 (good form)
  dataset/training_data/bad/*.mp4   → label = 0 (bad form)

Output: model/bicep_curl_landmarks.csv
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os
import math

from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR     = os.path.dirname(BASE_DIR)
DATASET_DIR     = os.path.join(PROJECT_DIR, "..", "dataset", "training_data")
OUTPUT_CSV      = os.path.join(BASE_DIR, "bicep_curl_landmarks.csv")
MODEL_TASK_PATH = os.path.join(BASE_DIR, "pose_landmarker.task")

CLASSES = {
    "good": 1,
    "bad":  0,
}

# ─── MediaPipe setup ──────────────────────────────────────────────────────────
FRAME_SKIP = 3   # Process every 3rd frame to avoid redundant frames

# ─── Landmark indices (MediaPipe Pose) ────────────────────────────────────────
# Left side  (camera sees left arm of subject)
L_SHOULDER = 11
L_ELBOW    = 13
L_WRIST    = 15
L_HIP      = 23

# Right side
R_SHOULDER = 12
R_ELBOW    = 14
R_WRIST    = 16
R_HIP      = 24


def calculate_angle(a, b, c):
    """Angle at point B between rays B→A and B→C (degrees)."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba = a - b
    bc = c - b
    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return math.degrees(math.acos(np.clip(cos_angle, -1.0, 1.0)))


def get_coords(lm, idx):
    return [lm[idx].x, lm[idx].y, lm[idx].z]


def extract_features(lm):
    """
    Extract 8 engineered features from a pose landmark frame.
    Uses whichever arm (left or right) has higher visibility.
    """
    l_vis = lm[L_ELBOW].visibility
    r_vis = lm[R_ELBOW].visibility

    # Choose the more visible arm
    if l_vis >= r_vis:
        sh, el, wr, hip = get_coords(lm, L_SHOULDER), get_coords(lm, L_ELBOW), get_coords(lm, L_WRIST), get_coords(lm, L_HIP)
        elbow_vis = l_vis
    else:
        sh, el, wr, hip = get_coords(lm, R_SHOULDER), get_coords(lm, R_ELBOW), get_coords(lm, R_WRIST), get_coords(lm, R_HIP)
        elbow_vis = r_vis

    # Feature 1: Elbow angle (main rep signal)
    elbow_angle = calculate_angle(sh, el, wr)

    # Feature 2: Shoulder-elbow distance (elbow flare measure)
    elbow_hip_dist = math.sqrt((el[0] - hip[0])**2 + (el[1] - hip[1])**2)

    # Feature 3: Wrist vs shoulder height (how high the curl goes)
    wrist_above_shoulder = sh[1] - wr[1]   # positive = wrist above shoulder

    # Feature 4: Shoulder angle (body sway / leaning forward)
    shoulder_angle = calculate_angle(hip, sh, el)

    # Feature 5: Wrist‑elbow horizontal offset (supination proxy)
    wrist_elbow_x = abs(wr[0] - el[0])

    # Feature 6: Elbow y relative to shoulder y (elbow rise)
    elbow_rise = sh[1] - el[1]

    # Feature 7: Torso lean (hip‑shoulder angle relative to vertical)
    torso_lean = abs(sh[0] - hip[0])

    # Feature 8: Visibility of the elbow landmark
    return [
        elbow_angle,
        elbow_hip_dist,
        wrist_above_shoulder,
        shoulder_angle,
        wrist_elbow_x,
        elbow_rise,
        torso_lean,
        elbow_vis,
    ]


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


def process_video(video_path, label, detector):
    """Extract features from every Nth frame of a video. Returns list of rows."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"  [WARN] Cannot open: {video_path}")
        return []

    rows = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % FRAME_SKIP == 0:
            # Convert BGR → RGB for MediaPipe
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            
            result = detector.detect(mp_image)

            if result.pose_landmarks and len(result.pose_landmarks) > 0:
                # result.pose_landmarks is a list of poses (we assume 1 person)
                lm = result.pose_landmarks[0]
                features = extract_features(lm)
                rows.append(features + [label])

        frame_idx += 1

    cap.release()
    return rows


def main():
    if not os.path.exists(MODEL_TASK_PATH):
        print(f"[ERROR] Pose model file not found at: {MODEL_TASK_PATH}")
        return

    all_rows = []
    total_videos = 0
    total_frames = 0

    # Initialize PoseLandmarker
    base_options = mp_python.BaseOptions(model_asset_path=MODEL_TASK_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        output_segmentation_masks=False)
    
    with vision.PoseLandmarker.create_from_options(options) as detector:

        for class_name, label in CLASSES.items():
            class_dir = os.path.join(DATASET_DIR, class_name)
            if not os.path.isdir(class_dir):
                print(f"[ERROR] Directory not found: {class_dir}")
                continue

            videos = [f for f in os.listdir(class_dir) if f.lower().endswith(".mp4")]
            print(f"\nProcessing '{class_name}' ({len(videos)} videos)...")

            for vid in videos:
                vid_path = os.path.join(class_dir, vid)
                print(f"  → {vid}  ", end="", flush=True)
                rows = process_video(vid_path, label, detector)
                all_rows.extend(rows)
                print(f"{len(rows)} frames")
                total_videos += 1
                total_frames += len(rows)

    if not all_rows:
        print("\n[ERROR] No landmark data extracted. Check video paths.")
        return

    cols = FEATURE_NAMES + ["label"]
    df = pd.DataFrame(all_rows, columns=cols)

    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    df.to_csv(OUTPUT_CSV, index=False)

    print(f"\n✅ Done!")
    print(f"   Videos processed : {total_videos}")
    print(f"   Total frames     : {total_frames}")
    print(f"   Output CSV       : {OUTPUT_CSV}")
    print(f"\n   Class distribution:")
    print(df["label"].value_counts().rename({1: "good", 0: "bad"}).to_string())


if __name__ == "__main__":
    main()
