# Testing Guide

This guide covers testing procedures for the Laguna Hills HOA Information and Service Management System.

## Accessibility Testing

Accessibility testing ensures that the application is usable by people with disabilities. Follow these procedures to verify accessibility compliance.

### 1. Automated Testing with Axe DevTools

**Installation:**
1. Install [Axe DevTools](https://www.deque.com/axe/devtools/) Chrome extension
2. Pin the extension to your browser toolbar for easy access

**Running Accessibility Scans:**

For each page in the application:
1. Open the page in Chrome browser
2. Click the Axe DevTools icon in the toolbar
3. Select "Scan ALL of my page" from the dropdown
4. Review the results panel for:
   - **Critical issues**: Must fix before release
   - **Serious issues**: Important to fix
   - **Moderate issues**: Should fix for better experience
   - **Minor issues**: Nice to have fixes

**Key Pages to Test:**
- `/` - Landing page
- `/login` - Login form
- `/dashboard` - Main dashboard
- `/map` - Interactive 2D map
- `/announcements` - Announcements list
- `/service-requests` - Service request forms
- `/payments` - Payment interface
- `/admin` - Admin panel (if accessible)

**Common Issues to Fix:**
- Missing alt text on images
- Low color contrast ratios (should be at least 4.5:1 for normal text)
- Missing form labels
- Empty links or buttons
- Missing ARIA labels on interactive elements
- Keyboard focus issues

### 2. Keyboard Navigation Testing

Test that all functionality is accessible using only a keyboard (no mouse).

**Basic Navigation:**
- `Tab` - Move focus forward through interactive elements
- `Shift + Tab` - Move focus backward
- `Enter` - Activate buttons, links, and form submissions
- `Space` - Toggle checkboxes and radio buttons
- `Arrow keys` - Navigate within lists, menus, and maps
- `Escape` - Close modals, dropdowns, and exit special modes

**Testing Procedure:**

1. **Tab Order Verification**
   - Press Tab through the entire page
   - Verify focus moves in logical order (left to right, top to bottom)
   - Ensure no elements are skipped
   - Check that focus indicators are clearly visible

2. **Interactive Elements**
   - Login and logout using keyboard only
   - Fill out forms (service requests, contact forms)
   - Navigate and use the interactive map
   - Open and close modals/dialogs
   - Expand/collapse accordions and menus

3. **Focus Management**
   - When a modal opens, focus should move inside it
   - When a modal closes, focus should return to triggering element
   - After form submission, focus should move to success message or error
   - Custom dropdowns should trap focus while open

4. **Skip Links**
   - Verify "Skip to main content" link appears on first Tab
   - Test that it bypasses navigation to reach main content

5. **Map Interaction**
   - Arrow keys should pan the map
   - +/- keys or dedicated buttons should zoom
   - Tab should move focus to map markers/lot polygons
   - Enter should activate selected map elements

**Common Issues to Fix:**
- Elements cannot receive focus (missing `tabindex`)
- Focus gets trapped in components
- No visible focus indicator
- Tab order is illogical
- Keyboard shortcuts conflict with browser/system shortcuts

### 3. Screen Reader Testing

Screen reader testing verifies that users with visual impairments can understand and navigate the application.

**Recommended Screen Readers:**
- **Windows**: NVDA (free, [nvaccess.org](https://www.nvaccess.org/))
- **Mac**: VoiceOver (built-in, Cmd + F5 to toggle)
- **Mobile**: TalkBack (Android) or VoiceOver (iOS)

**Getting Started:**
- Learn basic screen reader shortcuts (see below)
- Test with sound off initially, use visual feedback
- Then test with sound on for full experience

**NVDA Keyboard Shortcuts (Windows):**
- `Ctrl + Alt + N` - Start/stop NVDA
- `Down arrow` - Read next line
- `Up arrow` - Read previous line
- `Tab` - Move to next element (reads label)
- `Shift + Tab` - Move to previous element
- `H` - Jump to next heading
- `Shift + H` - Jump to previous heading
- `1-6` - Jump to heading level (e.g., `1` for h1, `2` for h2)
- `L` - Jump to next list
- `F` - Jump to next form field
- `B` - Jump to next button
- `K` - Jump to next link
- `Ctrl` - Silence speech
- `NVDA + Space` - Toggle between focus and browse modes

**VoiceOver Shortcuts (Mac):**
- `Cmd + F5` - Toggle VoiceOver on/off
- `Ctrl + Option + Right arrow` - Move to next element
- `Ctrl + Option + Left arrow` - Move to previous element
- `Ctrl + Option + Shift + Down arrow` - Interact with element
- `Ctrl + Option + Shift + Up arrow` - Stop interacting
- `Ctrl + Option + H` - Jump to heading
- `Ctrl + Option + Command + H` - Jump to heading level

**Testing Procedure:**

1. **Page Structure**
   - Navigate using headings to understand page organization
   - Verify landmarks are announced ("main", "navigation", "banner")
   - Check that lists are announced as lists
   - Ensure heading levels are logical (no skipped levels)

2. **Forms**
   - Tab through form fields
   - Verify each field's label is announced
   - Check required fields are indicated
   - Test error messages are announced and associated with fields
   - Verify success/confirmation messages are announced

3. **Interactive Elements**
   - Buttons should be announced with their purpose
   - Links should indicate destination (not just "click here")
   - Custom dropdowns should announce current state
   - Map markers should have descriptive labels
   - Modals should announce title and presence

4. **Map Accessibility**
   - Overall map should have descriptive label
   - Interactive lots should be navigable
   - Selected lot information should be announced
   - Map controls (zoom, pan) should be labeled
   - Consider providing alternative data table for complex map data

5. **Dynamic Content**
   - Live regions should announce updates (announcements, notifications)
   - Loading states should be communicated
   - Form validation errors should be announced immediately

**Common Issues to Fix:**
- Images missing alt text or having poor alt text
- Form inputs without associated labels
- Buttons labeled "click here" or "read more"
- Heading levels used for styling (not semantic)
- ARIA attributes missing or incorrect
- Focus changes not announced
- Status updates not communicated
- Empty links with icons only

### 4. Color Contrast Testing

Verify text and interactive elements have sufficient color contrast for readability.

**Tools:**
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Axe DevTools (built-in contrast checks)

**Requirements:**
- Normal text (< 18pt): Minimum 4.5:1 contrast ratio
- Large text (18pt+ or 14pt+ bold): Minimum 3:1 contrast ratio
- Interactive elements (buttons, links): Minimum 3:1 contrast ratio
- Graphics/icons conveying information: Minimum 3:1 contrast ratio

**Testing:**
1. Use Axe DevTools contrast checker
2. Verify all text meets minimum ratios
3. Check text on images/backgrounds
4. Verify form field borders have sufficient contrast
5. Test focus indicators are visible

### 5. Mobile Accessibility

Test accessibility on mobile devices with touch and screen reader.

**Testing:**
1. Enable screen reader (TalkBack/VoiceOver)
2. Test all user flows with touch gestures
3. Verify touch targets are at least 44x44 pixels
4. Check that swiping gestures don't conflict with screen reader
5. Test landscape and portrait orientations

### 6. Documentation

After testing, document:
- Issues found and their severity
- Fixes applied
- Remaining known issues
- Testing date and tester name
- Browser and assistive technology versions used

## Running Tests

```bash
# Start the application
npm run dev:all

# Visit in browser
# http://localhost:5173
```

Then follow the testing procedures above.

## Continuous Accessibility

Make accessibility testing part of your regular development workflow:
- Test each new feature for accessibility
- Run Axe DevTools scan before committing
- Consider keyboard navigation during development
- Include accessibility in code review checklist

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Accessibility Checklist](https://webaim.org/standards/wcag/checklist)
- [Axe Core Rules](https://www.deque.com/axe/core/rules/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
