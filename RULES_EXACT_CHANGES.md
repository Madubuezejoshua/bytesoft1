# Firestore Rules Changes - Exact Locations

## File: firestore.rules

### Change 1: Classes Counter Rules in Users Collection

**Location:** Lines 62-95 (within `/users/{userId}` match block)

**Added Rules:**

```plaintext
      // Teachers can update their own classesHeld field (auto-updated from admin/teacher dashboard)
      allow update: if isOwner(userId) && isTeacher() && (
        request.resource.data.keys().hasOnly(['classesHeld']) ||
        (request.resource.data.keys().hasOnly(['fullName', 'username', 'profilePicture', 'debitAccount', 'email', 'name', 'role', 'customUserId', 'createdAt', 'classesHeld']) &&
         !('isVerified' in request.resource.data.keys()))
      );

      // Coordinators can update teachers' classesHeld field for manual corrections
      allow update: if isCoordinator() && 
        get(/databases/$(database)/documents/users/$(userId)).data.role == 'teacher' &&
        (request.resource.data.keys().hasOnly(['classesHeld']) ||
         request.resource.data.keys().hasOnly(['classesHeld', 'email', 'name', 'role', 'customUserId', 'createdAt', 'fullName', 'username', 'profilePicture', 'debitAccount']));
```

**Modified Rule:**

Old (Lines 69-77):
```plaintext
      // Students can only update their own non-sensitive fields
      // Explicitly prevent any modification of verification-related fields
      allow update: if isOwner(userId) && (
        request.resource.data.keys().hasOnly(['fullName', 'username', 'profilePicture', 'debitAccount', 'email', 'name', 'role', 'customUserId', 'createdAt']) &&
        !('isVerified' in request.resource.data.keys()) &&
        !('verified' in request.resource.data.keys()) &&
        !('verificationType' in request.resource.data.keys()) &&
        !('purchasedCourses' in request.resource.data.keys()) &&
        !('verifiedBy' in request.resource.data.keys()) &&
        !('verifiedAt' in request.resource.data.keys())
      );
```

New (Lines 69-78):
```plaintext
      // Students can only update their own non-sensitive fields
      // Explicitly prevent any modification of verification-related fields
      allow update: if isOwner(userId) && (
        request.resource.data.keys().hasOnly(['fullName', 'username', 'profilePicture', 'debitAccount', 'email', 'name', 'role', 'customUserId', 'createdAt']) &&
        !('isVerified' in request.resource.data.keys()) &&
        !('verified' in request.resource.data.keys()) &&
        !('verificationType' in request.resource.data.keys()) &&
        !('purchasedCourses' in request.resource.data.keys()) &&
        !('verifiedBy' in request.resource.data.keys()) &&
        !('verifiedAt' in request.resource.data.keys()) &&
        !('classesHeld' in request.resource.data.keys())  // NEW LINE
      );
```

**Change:** Added `!('classesHeld' in request.resource.data.keys())` to prevent students from modifying the field.

---

### Change 2: New Teacher Reviews Collection

**Location:** Lines 185-202 (new collection match block)

**Added:**

```plaintext
    // Teacher Reviews collection
    match /teacher_reviews/{reviewId} {
      // Students can read reviews (for transparency)
      allow read: if isStudent();
      // Teachers can read reviews of themselves
      allow read: if isTeacher() && resource.data.teacherId == request.auth.uid;
      // Coordinators and admins can read all reviews
      allow read: if isCoordinator() || isAdmin();
      // Students can create reviews
      allow create: if isStudent() && request.resource.data.reviewerType == 'student' && request.resource.data.studentId == request.auth.uid;
      // Coordinators can create reviews
      allow create: if isCoordinator() && request.resource.data.reviewerType == 'coordinator' && request.resource.data.coordinatorId == request.auth.uid;
      // Only admins can update or delete reviews
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
```

**Position:** Inserted before the Admin collection match block (which used to start at line 185).

---

## Summary of Changes

| Item | Type | Location | Lines |
|------|------|----------|-------|
| Student classesHeld blocker | Modified | Users collection | Added line 78 |
| Teacher classesHeld updater | New | Users collection | Lines 80-87 |
| Coordinator classesHeld updater | New | Users collection | Lines 89-95 |
| Teacher reviews collection | New | Document body | Lines 185-202 |

---

## Total File Changes

- **Lines added:** 35-40 (teacher reviews collection + classesHeld rules)
- **Lines modified:** 1 (student update rule)
- **Original file lines:** 396
- **New file lines:** 427
- **Net change:** +31 lines

---

## Validation Commands

### Check for syntax errors:
```bash
firebase rules:test --config firestore.rules
```

### Check specific rules:
```bash
firebase rules:test --config firestore.rules --rules-file firestore.rules
```

### Dry run deployment:
```bash
firebase deploy --only firestore:rules --dry-run
```

### Actual deployment:
```bash
firebase deploy --only firestore:rules
```

---

## Rollback Instructions

If needed to rollback to previous version:

1. Restore firestore.rules from git:
   ```bash
   git checkout firestore.rules
   ```

2. Deploy previous version:
   ```bash
   firebase deploy --only firestore:rules
   ```

3. Verify in Firebase Console that "Last deployed" timestamp reverted

---

## Testing After Deployment

### Test 1: Verify Students Cannot Modify classesHeld
```javascript
// This should FAIL with "Permission denied"
const userRef = doc(db, 'users', currentUserId);
await updateDoc(userRef, { classesHeld: 999 });
```

### Test 2: Verify Teachers Can Update Own classesHeld
```javascript
// This should PASS (teacher updating own field)
const userRef = doc(db, 'users', currentTeacherId);
await updateDoc(userRef, { classesHeld: 5 });
```

### Test 3: Verify Coordinators Can Update Teacher's classesHeld
```javascript
// This should PASS (coordinator updating teacher)
const userRef = doc(db, 'users', teacherId);
await updateDoc(userRef, { classesHeld: 8 });
```

### Test 4: Verify Student Can Create Review
```javascript
// This should PASS
await addDoc(collection(db, 'teacher_reviews'), {
  teacherId: 'teacher-id',
  courseId: 'course-id',
  studentId: currentUserId,  // Must match auth user
  studentName: 'Jane Doe',
  reviewerType: 'student',
  rating: 5,
  comment: 'Excellent teaching!',
  createdAt: new Date().toISOString()
});
```

### Test 5: Verify Student Cannot Create Review with Wrong ID
```javascript
// This should FAIL with "Permission denied"
await addDoc(collection(db, 'teacher_reviews'), {
  teacherId: 'teacher-id',
  courseId: 'course-id',
  studentId: 'different-user-id',  // Different from auth user
  studentName: 'Hacker',
  reviewerType: 'student',
  rating: 1,
  comment: 'Fake review',
  createdAt: new Date().toISOString()
});
```

---

## Logs to Monitor

After deployment, watch for:

### Permission Denied Errors
These are EXPECTED for unauthorized operations - good sign rules work:
```
Operation path: users/{userId}, Method: update
Error: Permission denied
```

### Review Creation Logs
These should appear when students submit reviews:
```
Operation path: teacher_reviews/{reviewId}, Method: create
Success: Added review for teacher
```

### Suspicious Patterns
Watch for repeated permission denials:
```
User {userId} attempted 50+ failed writes in 5 minutes
→ Possible attack attempt, may need to block user
```

---

## Monitoring Dashboard

In Firebase Console, go to:
1. Firestore → Rules
2. Check "Last deployed" timestamp
3. View "Violations" tab to see permission denials
4. Set up alerts for unusual patterns

---

## Next Steps

1. ✅ Verify firestore.rules syntax is correct
2. ✅ Run validation test: `firebase rules:test`
3. ⏳ Deploy to staging: `firebase deploy --only firestore:rules --project staging`
4. ⏳ Run test suite against staging
5. ⏳ Deploy to production: `firebase deploy --only firestore:rules`
6. ⏳ Monitor logs for 24 hours
7. ⏳ Confirm features working in production
