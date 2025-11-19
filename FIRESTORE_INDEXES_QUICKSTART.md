# Firestore Indexes - Quick Reference

## Required Indexes for Teacher Details Enhancement

Execute these commands from your project root directory to create the required Firestore indexes:

### Index 1: REQUIRED - Enrollments Pagination & Sorting
```bash
firebase firestore:indexes:create --collection=enrollments --fields="teacherId,enrolledAt"
```

**Purpose**: Enables efficient pagination and sorting of enrolled students by enrollment date
**Fields**:
- `teacherId` (Ascending) - Filter by teacher
- `enrolledAt` (Descending) - Sort by date, newest first

**Expected Creation Time**: 5-10 minutes

---

### Index 2: REQUIRED - Reviews Sorting by Date
```bash
firebase firestore:indexes:create --collection=teacher_reviews --fields="teacherId,createdAt"
```

**Purpose**: Enables efficient retrieval of reviews sorted by creation date
**Fields**:
- `teacherId` (Ascending) - Filter by teacher
- `createdAt` (Descending) - Sort by date, newest first

**Expected Creation Time**: 5-10 minutes

---

### Index 3: OPTIONAL (Recommended) - Verification Status Filtering
```bash
firebase firestore:indexes:create --collection=enrollments --fields="teacherId,verified"
```

**Purpose**: Enables fast filtering by verification status
**Fields**:
- `teacherId` (Ascending) - Filter by teacher
- `verified` (Ascending) - Filter by verification status

**Expected Creation Time**: 3-5 minutes

---

## Verify Indexes

### List all Firestore indexes:
```bash
firebase firestore:indexes:list
```

### Monitor index creation:
```bash
firebase firestore:indexes:build
```

### Go to Firebase Console:
1. Navigate to: https://console.firebase.google.com
2. Select your project
3. Go to Firestore Database
4. Click "Indexes" tab
5. Verify all indexes show "Enabled" status

---

## Deployment Workflow

### 1. Create Indexes
```bash
# Run in order
firebase firestore:indexes:create --collection=enrollments --fields="teacherId,enrolledAt"
firebase firestore:indexes:create --collection=teacher_reviews --fields="teacherId,createdAt"
firebase firestore:indexes:create --collection=enrollments --fields="teacherId,verified"

# Wait 5-15 minutes for indexes to build
```

### 2. Deploy Updated Rules
```bash
firebase deploy --only firestore:rules
```

### 3. Deploy Application
```bash
npm run build
firebase deploy
```

### 4. Verify Everything Works
- Open Coordinator Dashboard
- Click "Teacher Reviews" tab
- Click "View Details" on any teacher
- Test pagination, search, and filter features

---

## Troubleshooting

### Issue: "Index not found" error when opening Teacher Details
**Solution**: 
- Verify index was created with `firebase firestore:indexes:list`
- If index shows "Creating", wait another 5-10 minutes for it to build
- Restart your application

### Issue: "Permission denied" errors
**Solution**:
- Ensure Firestore rules have been deployed: `firebase deploy --only firestore:rules`
- Verify coordinator role is properly set in user document

### Issue: Large datasets (1000+ students) causing slow search
**Solution**:
- This is normal for client-side filtering of large datasets
- Consider using Algolia or Meilisearch for full-text search
- Implement virtual scrolling for the student list

### Issue: "Composite index creation failed"
**Solution**:
- Ensure you have proper Firebase project permissions
- Check your Firebase plan supports custom indexes
- Try creating index through Firebase Console instead:
  1. Go to Firestore > Indexes
  2. Click "Create Index" (manual UI)
  3. Enter collection name and field configuration

---

## Index Configuration Details

### Index 1: enrollments / teacherId, enrolledAt
```
Collection: enrollments
Query Scope: Collection
Fields:
  - teacherId (Ascending)
  - enrolledAt (Descending)
```

### Index 2: teacher_reviews / teacherId, createdAt
```
Collection: teacher_reviews
Query Scope: Collection
Fields:
  - teacherId (Ascending)
  - createdAt (Descending)
```

### Index 3: enrollments / teacherId, verified
```
Collection: enrollments
Query Scope: Collection
Fields:
  - teacherId (Ascending)
  - verified (Ascending)
```

---

## Firestore CLI Installation (if needed)

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version

# Login to Firebase
firebase login

# Select your project
firebase use <PROJECT_ID>
```

---

## Expected Behavior After Indexes

After indexes are created and "Enabled" status shows:

✅ Teacher Details dialog loads students list in < 2 seconds
✅ Pagination instant switching between pages
✅ Search filters results in real-time (< 100ms)
✅ Verification status filter works instantly
✅ Reviews load and display sorted by date

---

**Last Updated**: November 19, 2025
**Status**: Ready for Deployment
