import cv2
import numpy as np

img = cv2.imread('public/turbine_model.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
c = max(contours, key=cv2.contourArea)

# Centroid of hub (x=124, y=236 in img)
hub_x, hub_y = 124.0, 236.0

# Calculate distance from each contour point to the hub
pts = c.reshape(-1, 2)
dists = np.sqrt((pts[:, 0] - hub_x)**2 + (pts[:, 1] - hub_y)**2)

# Find local maxima of distance
# Let's filter points that have a distance greater than 50 pixels
candidates = []
for i in range(len(pts)):
    if dists[i] < 50:
        continue
    # Check if it's a local maximum in a neighborhood of 20 points
    is_max = True
    for j in range(-25, 26):
        idx = (i + j) % len(pts)
        if dists[idx] > dists[i]:
            is_max = False
            break
    if is_max:
        candidates.append((pts[i][0], pts[i][1], dists[i]))

# Print unique local maxima (avoid duplicates near the same tip)
unique_candidates = []
for x, y, d in sorted(candidates, key=lambda val: val[2], reverse=True):
    # Check if too close to already added points
    too_close = False
    for ux, uy, ud in unique_candidates:
        dist = np.sqrt((x - ux)**2 + (y - uy)**2)
        if dist < 30:
            too_close = True
            break
    if not too_close:
        unique_candidates.append((x, y, d))

scale = 630.0 / 668.0
x_offset = 200.0 - (219.0 * scale / 2.0)
y_offset = 10.0

def to_svg(x_img, y_img):
    return round(x_offset + x_img * scale), round(y_offset + y_img * scale)

print("Found tips:")
for i, (x, y, d) in enumerate(unique_candidates):
    print(f"Tip {i}: img=({x}, {y}), dist={d:.1f} -> SVG={to_svg(x, y)}")
