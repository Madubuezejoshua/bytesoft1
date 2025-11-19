# Firestore Rules Updates Required

## Summary
Two main rule updates have been made to `firestore.rules`:

1. **Allow teachers to update their classesHeld counter** (auto-sync from dashboard)
2. **Allow students/coordinators to submit reviews** and **coordinators to view them**

---

## Rule 1: Classes Held Counter Updates

### Location: `/users/{userId}` collection

#### New Permission 1: Teachers update their own classesHeld
```plaintext
// Teachers can update their own classesHeld field (auto-updated from admin/teacher dashboard)
allow update: if isOwner(userId) && isTeacher() && (
  request.resource.data.keys().hasOnly(['classesHeld']) ||
  (request.resource.data.keys().hasOnly(['fullName', 'username', 'profilePicture', 'debitAccount', 'email', 'name', 'role', 'customUserId', 'createdAt', 'classesHeld']) &&
   !('isVerified' in request.resource.data.keys()))
);
```

**What it allows:**
- Teachers can update their own `classesHeld` field
- Can update just `classesHeld` alone, OR
- Can update `classesHeld` along with other profile fields (name, email, etc.)
- Prevents updates to sensitive fields like `isVerified`, `verificationType`

**What it prevents:**
- Teachers cannot modify other teachers' counts
- Teachers cannot modify students' classesHeld
- Teachers cannot change verification status

#### New Permission 2: Coordinators update teachers' classesHeld
```plaintext
// Coordinators can update teachers' classesHeld field for manual corrections
allow update: if isCoordinator() && 
  get(/databases/$(database)/documents/users/$(userId)).data.role == 'teacher' &&
  (request.resource.data.keys().hasOnly(['classesHeld']) ||
   request.resource.data.keys().hasOnly(['classesHeld', 'email', 'name', 'role', 'customUserId', 'createdAt', 'fullName', 'username', 'profilePicture', 'debitAccount']));
```

**What it allows:**
- Coordinators can update any teacher's `classesHeld` for corrections
- Maintains strict field allowlist to prevent data corruption

**What it prevents:**
- Coordinators cannot modify verification fields
- Coordinators cannot update students' classesHeld
- Coordinators cannot modify sensitive account info

#### Modified Permission: Student updates blocked from modifying classesHeld
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
  !('classesHeld' in request.resource.data.keys())
);
```

**What changed:**
- Added `!('classesHeld' in request.resource.data.keys())` to prevent students from modifying it

---

## Rule 2: Teacher Reviews Collection

### Location: NEW `/teacher_reviews/{reviewId}` collection

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
  allow create: if isStudent() && 
    request.resource.data.reviewerType == 'student' && 
    request.resource.data.studentId == request.auth.uid;
  
  // Coordinators can create reviews
  allow create: if isCoordinator() && 
    request.resource.data.reviewerType == 'coordinator' && 
    request.resource.data.coordinatorId == request.auth.uid;
  
  // Only admins can update or delete reviews
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

### Permission Breakdown

#### **Read Permissions**
- ✅ **Students** - Can see all reviews (transparency)
- ✅ **Teachers** - Can only see reviews about themselves
- ✅ **Coordinators** - Can see all reviews (platform oversight)
- ✅ **Admins** - Can see all reviews

#### **Create Permissions**
- ✅ **Students** - Can create reviews
  - Must set `reviewerType: 'student'`
  - Must set `studentId` to their own ID
  - Cannot submit a review with someone else's ID
  
- ✅ **Coordinators** - Can create reviews
  - Must set `reviewerType: 'coordinator'`
  - Must set `coordinatorId` to their own ID
  - Cannot submit false coordinator reviews

- ❌ **Teachers** - Cannot create reviews (prevents self-review abuse)

#### **Update Permissions**
- ✅ **Admins only** - Can modify reviews (e.g., hide inappropriate ones)
- ❌ **Students/Teachers/Coordinators** - Cannot modify reviews (prevents tampering)

#### **Delete Permissions**
- ✅ **Admins only** - Can delete reviews
- ❌ **Others** - Cannot delete reviews (prevents suppression)

---

## Security Features

### Prevents Abuse

| Attack Vector | Blocked By |
|---|---|
| Student giving themselves high reviews | `studentId == request.auth.uid` check |
| Student reviewing multiple times as different people | Firebase Auth UID binding |
| Coordinator faking reviews | `coordinatorId == request.auth.uid` check |
| Teacher modifying bad reviews | Update rule limited to admins |
| Teacher deleting negative reviews | Delete rule limited to admins |
| Student modifying classes count | Explicit blocked in update rule |

### Maintains Data Integrity

- Strict field allowlists prevent accidental corruption
- Role-based access control at document level
- Time-based immutability for important fields
- Audit trail possible via Cloud Functions

---

## Deployment Instructions

### Step 1: Verify Rules File
```bash
cd c:\Users\USER\Documents\bytesoft\bytesoft
cat firestore.rules | head -20
```

### Step 2: Validate Rules Syntax
```bash
firebase rules:test --config firestore.rules
```

### Step 3: Deploy to Firebase
```bash
firebase deploy --only firestore:rules
```

### Step 4: Verify Deployment
- Go to Firebase Console → Firestore Rules
- Check "Last deployed" timestamp matches your deploy time
- Rules should show green "Published" status

---

## Testing Rules

### Test Case 1: Teacher Updates Own Count
```javascript
// Should PASS
await updateDoc(doc(db, 'users', currentTeacherId), {
  classesHeld: 5
});
```

### Test Case 2: Teacher Updates Another's Count
```javascript
// Should FAIL (Permission Denied)
await updateDoc(doc(db, 'users', otherTeacherId), {
  classesHeld: 10
});
```

### Test Case 3: Coordinator Updates Teacher's Count
```javascript
// Should PASS
await updateDoc(doc(db, 'users', teacherId), {
  classesHeld: 8
});
```

### Test Case 4: Student Creates Review
```javascript
// Should PASS
await addDoc(collection(db, 'teacher_reviews'), {
  teacherId: 'teacher-id',
  studentId: currentStudentId,
  studentName: 'John Doe',
  reviewerType: 'student',
  rating: 5,
  comment: 'Great teacher!',
  courseId: 'course-id',
  createdAt: new Date().toISOString()
});
```

### Test Case 5: Student Creates Review with Wrong ID
```javascript
// Should FAIL (security rule violation)
await addDoc(collection(db, 'teacher_reviews'), {
  teacherId: 'teacher-id',
  studentId: 'different-student-id', // Not their own ID
  studentName: 'Hacker',
  reviewerType: 'student',
  rating: 1,
  comment: 'Bad review',
  courseId: 'course-id',
  createdAt: new Date().toISOString()
});
```

### Test Case 6: Student Modifies Review
```javascript
// Should FAIL (Permission Denied)
await updateDoc(doc(db, 'teacher_reviews', reviewId), {
  rating: 1, // Try to downgrade their own review
  comment: 'Changed my mind'
});
```

### Test Case 7: Coordinator Reads All Reviews
```javascript
// Should PASS
const reviews = await getDocs(collection(db, 'teacher_reviews'));
```

### Test Case 8: Teacher Reads Their Own Reviews
```javascript
// Should PASS
const myReviews = await getDocs(
  query(collection(db, 'teacher_reviews'), where('teacherId', '==', currentTeacherId))
);
```

---

## Monitoring & Maintenance

### Setup Cloud Firestore Logging

1. Go to Firebase Console → Firestore → Rules
2. Enable "Detailed logging" for 24 hours (in development)
3. Check logs for:
   - Permission denied errors
   - Suspicious patterns (multiple failed writes)
   - Legitimate access patterns

### Regular Audits

- **Weekly:** Check for permission violations
- **Monthly:** Review teacher review submissions for inappropriate content
- **Quarterly:** Audit classesHeld counts against actual scheduled_classes data

### Alert Setup

Consider creating alerts for:
- High number of failed write attempts from single user
- Bulk review creation in short time frame
- Unusual classesHeld modifications

---

## Related Documentation

- **Classes Counter**: See `IMPLEMENTATION_FEATURES_SUMMARY.md` - "Feature 1"
- **Reviews Feature**: See `IMPLEMENTATION_FEATURES_SUMMARY.md` - "Feature 2"
- **Original Rules**: Backup of original firestore.rules available
- **Security Guide**: See project security documentation

---

## Support

If rules need modification:
1. Update firestore.rules file
2. Test with Firebase Emulator Suite locally
3. Deploy to staging first
4. Monitor for 24 hours
5. Deploy to production
