# Firestore Rules: Classes Counter & Reviews - Summary

## TL;DR - What Changed in firestore.rules

### 1. Classes Held Counter (`/users/{userId}`)

**Teachers** can now update their own `classesHeld` field:
```
allow update: if isOwner(userId) && isTeacher() && ...classesHeld fields...
```

**Coordinators** can update any teacher's `classesHeld`:
```
allow update: if isCoordinator() && ...teacher check... && ...classesHeld fields...
```

**Students** are explicitly blocked from modifying `classesHeld`.

---

### 2. Teacher Reviews (NEW `/teacher_reviews/{reviewId}`)

```
READ:
✅ Students: Can see all reviews
✅ Teachers: Can see reviews about themselves  
✅ Coordinators: Can see all reviews
✅ Admins: Can see all reviews

CREATE:
✅ Students: Can create reviews (with their own studentId)
✅ Coordinators: Can create reviews (with their own coordinatorId)
❌ Teachers: Cannot create reviews

UPDATE/DELETE:
✅ Admins only: Can modify/delete reviews
❌ Others: Cannot modify or delete
```

---

## Security Highlights

| Risk | Protection |
|------|-----------|
| Student fakes review with another student's ID | Required `studentId == request.auth.uid` |
| Coordinator submits fake review | Required `coordinatorId == request.auth.uid` |
| Teacher deletes negative review | Only admins can delete |
| Student modifies classes count | Blocked in update rule |
| Teacher gives self high review | Teachers can't create reviews |

---

## Files That Need Updating

### Before Deployment

1. **firestore.rules** - Already updated ✅
   - Classes counter rules added
   - Teacher reviews collection rules added

2. **Deploy Command**
   ```bash
   firebase deploy --only firestore:rules
   ```

### Verification

After deploying, verify in Firebase Console:
1. Go to Firestore → Rules
2. Check "Last deployed" timestamp
3. Should show "Published" status in green

---

## Quick Validation

These should work after rules deployed:

✅ Teacher updates own classesHeld
✅ Coordinator updates teacher's classesHeld  
✅ Student creates review with own ID
✅ Coordinator creates review with own ID
✅ Coordinator views all teacher reviews
✅ Teacher views reviews about themselves

❌ Student modifies classesHeld
❌ Student creates review with another's ID
❌ Teacher deletes negative review
❌ Student modifies published review

---

## Related Files

- **Full Rules Guide**: `FIRESTORE_RULES_UPDATES.md`
- **Feature Summary**: `IMPLEMENTATION_FEATURES_SUMMARY.md`
- **Completion Status**: `IMPLEMENTATION_COMPLETION.md`

## Questions?

If rules need adjustments:
1. Edit firestore.rules
2. Test locally: `firebase emulators:start`
3. Deploy to staging first
4. Deploy to production after verification
