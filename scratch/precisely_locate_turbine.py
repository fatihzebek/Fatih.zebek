import cv2
import numpy as np

img = cv2.imread('public/turbine_model.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)

# Find the three blade tips
# Blade 1 tip (topmost):
y_indices, x_indices = np.where(thresh > 0)
top_idx = y_indices.argmin()
blade1_img = (x_indices[top_idx], y_indices[top_idx])

# Blade 2 tip (leftmost, above tower base):
# Tower base is at the bottom, let's restrict to y < 500
y_upper_indices = y_indices[y_indices < 500]
x_upper_indices = x_indices[y_indices < 500]
left_idx = x_upper_indices.argmin()
blade2_img = (x_upper_indices[left_idx], y_upper_indices[left_idx])

# Blade 3 tip (rightmost, above tower base):
right_idx = x_upper_indices.argmax()
blade3_img = (x_upper_indices[right_idx], y_upper_indices[right_idx])

# Let's find the hub center. The hub center is the point where the blades meet.
# We can find it by finding the center of the contour of the hub/nacelle.
# Let's find the skeleton or find the centroid of the hub region.
# In the y range 200-300, the hub is a dense area. Let's find the centroid of the thresholded pixels in this range.
y_hub_mask = (y_indices >= 220) & (y_indices <= 280) & (x_indices >= 80) & (x_indices <= 140)
hub_x = x_indices[y_hub_mask].mean()
hub_y = y_indices[y_hub_mask].mean()
hub_img = (hub_x, hub_y)

scale = 630.0 / 668.0
x_offset = 200.0 - (219.0 * scale / 2.0)
y_offset = 10.0

def to_svg(x_img, y_img):
    return round(x_offset + x_img * scale), round(y_offset + y_img * scale)

print("Blade 1 Tip (img):", blade1_img, "-> SVG:", to_svg(blade1_img[0], blade1_img[1]))
print("Blade 2 Tip (img):", blade2_img, "-> SVG:", to_svg(blade2_img[0], blade2_img[1]))
print("Blade 3 Tip (img):", blade3_img, "-> SVG:", to_svg(blade3_img[0], blade3_img[1]))
print("Hub Center (img):", hub_img, "-> SVG:", to_svg(hub_img[0], hub_img[1]))
