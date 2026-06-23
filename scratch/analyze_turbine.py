import cv2
import numpy as np

img = cv2.imread('public/turbine_model.png')
print("Image shape:", img.shape)

# Convert to grayscale
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Threshold to find non-white pixels (background is white)
_, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

# Save threshold image for verification
cv2.imwrite('scratch/turbine_thresh.png', thresh)

# Find coordinates of non-white pixels
y_indices, x_indices = np.where(thresh > 0)

print("Bounding box of turbine:")
print("x min:", x_indices.min(), "x max:", x_indices.max())
print("y min:", y_indices.min(), "y max:", y_indices.max())

# Let's find contours
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
print("Number of contours:", len(contours))

# Let's find the largest contour
c = max(contours, key=cv2.contourArea)

# Let's find extreme points
extLeft = tuple(c[c[:, :, 0].argmin()][0])
extRight = tuple(c[c[:, :, 0].argmax()][0])
extTop = tuple(c[c[:, :, 1].argmin()][0])
extBottom = tuple(c[c[:, :, 1].argmax()][0])

print("Contours Extreme Points:")
print("extLeft (leftmost):", extLeft)
print("extRight (rightmost):", extRight)
print("extTop (topmost):", extTop)
print("extBottom (bottommost):", extBottom)

# Let's scale to SVG viewBox space
# Scale factor: y_svg = 10 + y_img * (630 / 668)
# x_svg = 96.73 + x_img * (630 / 668)
scale = 630.0 / 668.0
x_offset = 200.0 - (219.0 * scale / 2.0)
y_offset = 10.0

def to_svg(x_img, y_img):
    return round(x_offset + x_img * scale), round(y_offset + y_img * scale)

print("SVG coordinates:")
print("Topmost (Blade 1 tip):", to_svg(extTop[0], extTop[1]))
print("Bottommost (Tower base):", to_svg(extBottom[0], extBottom[1]))
print("Leftmost (Blade 2 tip):", to_svg(extLeft[0], extLeft[1]))
print("Rightmost (Blade 3 tip):", to_svg(extRight[0], extRight[1]))
