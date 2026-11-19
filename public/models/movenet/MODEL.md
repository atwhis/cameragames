# MoveNet MultiPose Lightning

Publisher: Google. TensorFlow.js model, version 1, Apache-2.0.

Source: https://www.kaggle.com/models/google/movenet/tfJs/multipose-lightning/1

Model card: https://storage.googleapis.com/movenet/MoveNet.MultiPose%20Model%20Card.pdf

Files downloaded unchanged from the official model archive. SHA-256 checksums are pinned in `scripts/download-model.mjs`.

This model detects up to six poses with 17 keypoints each. This application accepts at most two assigned players. Tracking IDs are transient spatial associations, not verified human identities. Accuracy depends on framing, lighting, occlusion and subject size. No face identification is performed.
