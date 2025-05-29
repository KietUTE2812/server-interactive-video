// Test data để kiểm thử hàm updateLectureProgress
// Dựa trên dữ liệu bạn cung cấp

const testData = {
    // ID của moduleItemProgress item trong mảng moduleItemProgresses
    moduleItemProgressId: "6836ef2e468d3cfbae2b98c9",

    // Dữ liệu progress video
    progressVideo: {
        completionPercentage: 15,
        watchedDuration: 2.856191,
        totalDuration: 18.633333,
        lastPosition: 2.856191,
        timeSpent: 0,
        videoId: '6815aea21e0d3f6428c70cad',
        milestone: 10,
        updatedAt: 1748451047698
    }
};

/* 
Cách sử dụng API endpoint mới:

PUT /api/v1/progress/lecture/6836ef2e468d3cfbae2b98c9

Headers:
- Authorization: Bearer <your_jwt_token>
- Content-Type: application/json

Body:
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

Response sẽ là:
{
  "success": true,
  "data": {
    "progress": {
      // Progress document đầy đủ
    },
    "updatedItem": {
      // Module item progress đã được cập nhật
    }
  },
  "message": "Lecture progress updated"
}
*/

// Ví dụ sử dụng với fetch
const updateLectureProgress = async (moduleItemProgressId, progressData) => {
    try {
        const response = await fetch(`/api/v1/progress/lecture/${moduleItemProgressId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` // hoặc cách bạn lưu token
            },
            body: JSON.stringify({
                progressVideo: progressData
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('Lecture progress updated successfully:', result.data);
            return result.data;
        } else {
            console.error('Failed to update lecture progress:', result.message);
            return null;
        }
    } catch (error) {
        console.error('Error updating lecture progress:', error);
        return null;
    }
};

// Ví dụ gọi hàm
// updateLectureProgress("6836ef2e468d3cfbae2b98c9", testData.progressVideo);

export { updateLectureProgress, testData }; 