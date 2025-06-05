export const getCourseDetails = async (args) => {
    const course = await Course.findById(args.id);
    return {
        course: course,
    };
};

export const getAllCourses = async () => {
    const courses = await Course.find();
    return {
        courses: courses,
    };
};

export const searchCourse = async (args) => {
    const courses = await Course.find({
        $or: [
            {title: {$regex: args.query, $options: 'i'}},
            {description: {$regex: args.query, $options: 'i'}},
            {tags: {$regex: args.query, $options: 'i'}},
        ],
    });
    return {
        courses: courses,
    };
};

export const getCourseReviews = async (args) => {
    const reviews = await Review.find({courseId: args.courseId});
    return {
        reviews: reviews,
    };
};

export const getPopularCourses = async () => {
    const courses = await Course.find().sort({rating: -1}).limit(5);
    return {
        courses: courses,
    };
};

