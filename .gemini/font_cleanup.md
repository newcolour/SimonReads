# Font Settings Cleanup

## Issue
The font settings in the Appearance tab had repetitive and redundant font options that didn't align with the Apple News-style design philosophy.

## Problems Identified

### Redundant Serif Fonts
- **Merriweather** (primary serif font)
- **Georgia** (similar serif)
- **Times New Roman** (similar serif)
- **Palatino Linotype** (similar serif)

Having 4 serif fonts was excessive and confusing for users.

### Redundant Sans-Serif Fonts
- **Inter** (primary sans-serif font)
- **Verdana** (similar sans-serif)

### Inappropriate Font
- **Courier New** (monospace) - Not suitable for article reading

## Solution

Simplified the font list to **4 curated options**:

1. **System Default** - Uses the operating system's default font
2. **Inter (Sans-serif)** - Modern, clean sans-serif (Apple News style)
3. **Merriweather (Serif)** - Elegant serif for comfortable reading (Apple News style)
4. **Georgia (Serif)** - Classic serif alternative

## Benefits

✅ **Clearer choices** - Users aren't overwhelmed with similar options
✅ **Better labels** - Font categories (Sans-serif/Serif) are now explicit
✅ **Apple News alignment** - Focuses on Inter and Merriweather as primary fonts
✅ **Reduced confusion** - No more wondering about the difference between similar fonts

## Font Usage in App

- **UI Elements**: Uses the selected font or defaults to Inter
- **Article Content**: Can switch between sans-serif (Inter) and serif (Merriweather/Georgia)
- **PDF Generation**: Uses Times (serif) for newspaper-style output

## Migration

Users who previously selected removed fonts will automatically fall back to:
- **Times New Roman** → **Georgia** (both serif)
- **Palatino Linotype** → **Georgia** (both serif)
- **Verdana** → **Inter** (both sans-serif)
- **Courier New** → **System Default**

The app will handle this gracefully without requiring user action.
