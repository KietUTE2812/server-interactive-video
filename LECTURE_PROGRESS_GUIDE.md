# Hướng dẫn sử dụng API cập nhật tiến độ lecture/video

## Tổng quan

Đã tạo API endpoint mới để cập nhật tiến độ lecture/video dựa trên ID của `moduleItemProgress` thay vì sử dụng video ID như trước.

## Endpoint mới

```
PUT /api/v1/progress/lecture/:id
```

### Parameters
- `:id` - ID của moduleItemProgress item (ví dụ: `6836ef2e468d3cfbae2b98c9`)

### Headers
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Request Body
```json
{
  "progressVideo": {
    "completionPercentage": 15,
    "watchedDuration": 2.856191,
    "totalDuration": 18.633333,
    "lastPosition": 2.856191,
    "timeSpent": 0,
    "videoId": "6815aea21e0d3f6428c70cad",
    "milestone": 10,
    "updatedAt": 1748451047698
  }
}
```

### Response Success (200)
```json
{
  "success": true,
  "data": {
    "progress": {
      "_id": "...",
      "userId": "...",
      "moduleId": "...",
      "courseId": "...",
      "moduleItemProgresses": [...]
    },
    "updatedItem": {
      "_id": "6836ef2e468d3cfbae2b98c9",
      "moduleItemId": "...",
      "status": "in-progress",
      "completionPercentage": 15,
      "timeSpent": 0,
      "attempts": 1,
      "result": {
        "video": {
          "watchedDuration": 2.856191,
          "totalDuration": 18.633333,
          "lastPosition": 2.856191,
          "completionPercentage": 15,
          "milestone": 10,
          "lastUpdated": "2025-01-28T..."
        }
      }
    }
  },
  "message": "Lecture progress updated"
}
```

## Cách hoạt động

1. **Tìm Progress Document**: Sử dụng `moduleItemProgressId` để tìm progress document chứa item này
2. **Xác thực Module Item**: Kiểm tra xem module item có phải là lecture/video không
3. **Cập nhật Progress**: 
   - Cập nhật status (in-progress khi > 0%, completed khi >= 95%)
   - Cập nhật completion percentage
   - Cộng dồn timeSpent
   - Tăng số lần attempts
   - Lưu thông tin chi tiết vào `result.video`

## Ví dụ sử dụng với JavaScript

### Frontend Integration
```javascript
const updateLectureProgress = async (moduleItemProgressId, progressData) => {
  try {
    const response = await fetch(`/api/v1/progress/lecture/${moduleItemProgressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        progressVideo: progressData
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Progress updated:', result.data.updatedItem);
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error updating lecture progress:', error);
    throw error;
  }
};

// Sử dụng trong video player
const handleProgressUpdate = (videoData) => {
  const progressData = {
    completionPercentage: Math.round((videoData.currentTime / videoData.duration) * 100),
    watchedDuration: videoData.currentTime,
    totalDuration: videoData.duration,
    lastPosition: videoData.currentTime,
    timeSpent: videoData.timeSpent || 0,
    videoId: videoData.videoId,
    milestone: Math.floor(videoData.currentTime / 10) * 10, // milestone mỗi 10 giây
    updatedAt: Date.now()
  };
  
  updateLectureProgress(moduleItemProgressId, progressData);
};
```

### React Hook Integration
```javascript
import { useCallback } from 'react';

const useProgressUpdate = (moduleItemProgressId) => {
  const updateProgress = useCallback(async (progressData) => {
    try {
      const result = await updateLectureProgress(moduleItemProgressId, progressData);
      // Có thể dispatch action để cập nhật state
      return result;
    } catch (error) {
      console.error('Failed to update progress:', error);
      return null;
    }
  }, [moduleItemProgressId]);
  
  const handleProgressTimeUpdate = useCallback((progressData) => {
    if (progressData) {
      // Đồng bộ currentTime với progress data nếu có sự khác biệt đáng kể
      const videoCurrentTime = videoRef.current?.currentTime || 0;
      if (Math.abs(videoCurrentTime - progressData.lastPosition) > 1) {
        setCurrentTime(progressData.lastPosition);
      }
      // Đồng bộ duration nếu chưa có
      if (progressData.totalDuration && !duration) {
        setDuration(progressData.totalDuration);
      }
    }
  }, [duration]);
  
  return { updateProgress, handleProgressTimeUpdate };
};
```

## Error Handling

### Possible Errors
- `400`: Module item is not a lecture/video
- `404`: Progress not found, Module item progress not found
- `500`: Server error

### Example Error Response
```json
{
  "success": false,
  "error": "This module item is not a lecture/video"
}
```

## Notes

- Tiến độ được coi là **completed** khi `completionPercentage >= 95%`
- `timeSpent` được cộng dồn từ các lần cập nhật
- `attempts` được tăng lên mỗi lần gọi API
- Nếu lecture đã completed, API sẽ trả về message "Lecture already completed"
- Progress được lưu trong transaction để đảm bảo tính nhất quán

## Migration từ API cũ

Nếu bạn đang sử dụng endpoint cũ:
```
PUT /api/v1/progress/:id/video
```

Hãy chuyển sang endpoint mới:
```
PUT /api/v1/progress/lecture/:moduleItemProgressId
```

Và đảm bảo sử dụng đúng ID của moduleItemProgress thay vì video ID. 