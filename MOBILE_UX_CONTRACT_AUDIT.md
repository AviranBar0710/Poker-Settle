# Mobile UX Contract v1 Compliance Audit

## Violations Found

### 🔴 Critical Violations

1. **ResultsStep Table (line 1728)** - Horizontal scrolling on mobile
   - **Location:** `app/session/[id]/page.tsx` - ResultsStep component
   - **Issue:** Table has `overflow-x-auto` allowing horizontal scroll
   - **Contract Violation:** #1 (No horizontal scrolling), #6 (Data Density - tables desktop-only)
   - **Fix:** Hide table on mobile, add card view

2. **Link Identity Dialog** - Centered modal on mobile
   - **Location:** `app/session/[id]/page.tsx` line 1367
   - **Issue:** Not using bottom sheet pattern
   - **Contract Violation:** #3 (Bottom sheets only on mobile)
   - **Fix:** Convert to bottom sheet with mobile positioning

3. **ShareResultsDialog** - Centered modal on mobile
   - **Location:** `app/session/[id]/page.tsx` line 2884
   - **Issue:** Not using bottom sheet pattern
   - **Contract Violation:** #3 (Bottom sheets only on mobile)
   - **Fix:** Convert to bottom sheet with mobile positioning

4. **FixedBuyinDialog** - Missing bottom sheet positioning
   - **Location:** `app/session/[id]/page.tsx` line 2813
   - **Issue:** Has flex layout but missing mobile positioning classes
   - **Contract Violation:** #3 (Bottom sheets only on mobile)
   - **Fix:** Add bottom sheet positioning classes

5. **Global Actions (Finalize/Review)** - Not thumb-reachable on mobile
   - **Location:** `app/session/[id]/page.tsx` line 1248
   - **Issue:** Buttons at bottom of content, not sticky footer
   - **Contract Violation:** #2 (Primary actions must be sticky or thumb-reachable)
   - **Fix:** Move to sticky footer on mobile

### 🟡 Medium Priority Issues

6. **Loading States** - No timeout fallbacks
   - **Location:** Multiple screens
   - **Issue:** Loading states can block UI indefinitely
   - **Contract Violation:** #8 (Timeout fallback required)
   - **Fix:** Add timeout fallbacks and error recovery

7. **Dashboard Primary Action** - Not in thumb zone
   - **Location:** `app/page.tsx` line 190
   - **Issue:** "New Session" button in header, may require reach
   - **Contract Violation:** #2 (Primary actions in lower 40%)
   - **Status:** Acceptable (header buttons are standard, but consider FAB on mobile)

### ✅ Already Compliant

- Create Session Dialog - Bottom sheet ✅
- Login Dialog - Bottom sheet ✅
- Edit Player Dialog - Bottom sheet ✅
- PlayersTable - Mobile cards ✅
- Stats Page - Mobile cards ✅
- Sessions History - Responsive cards ✅
- Sticky Footer Actions - Session page ✅

## Fix Priority

1. Fix horizontal scrolling (ResultsStep table)
2. Convert dialogs to bottom sheets (Link Identity, Share Results, Fixed Buy-in)
3. Move Global Actions to sticky footer
4. Add loading state timeouts
5. Verify thumb-reachability

