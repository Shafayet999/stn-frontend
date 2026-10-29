import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyEnrollments } from "../../store/slices/enrollmentSlice";
import { Link } from "react-router-dom";
import { getQuizStats } from "../../services/quiz.api";
import { getAssignmentStats } from "../../services/assignment.api";
import { getCourseById } from "../../services/courses.api";

export default function StudentDashboard() {
    const dispatch = useDispatch();
    const { enrollments = [], loading = false, error = null } = useSelector((state) => state.enrollment || {});
    const { currentCourse } = useSelector((state) => state.courses || {});

    // Safe array check to prevent runtime crashes
    const safeEnrollments = Array.isArray(enrollments) ? enrollments : [];

    const [expandedCourse, setExpandedCourse] = useState(null);
    const [courseStats, setCourseStats] = useState({});
    const [loadingStats, setLoadingStats] = useState({});

    const lessonTitleCache = useRef({});

    useEffect(() => {
        dispatch(fetchMyEnrollments());
    }, [dispatch]);

    const createLessonMap = (courseData) => {
        if (!courseData?.syllabus) return {};
        const map = {};
        courseData.syllabus.forEach(module => {
            if (module.lessons) {
                module.lessons.forEach(lesson => {
                    map[String(lesson._id)] = lesson.title;
                });
            }
        });
        return map;
    };

    const getLessonTitle = (courseId, lessonId) => {
        const cacheKey = `${courseId}_${lessonId}`;
        if (lessonTitleCache.current[cacheKey]) {
            return lessonTitleCache.current[cacheKey];
        }

        const stats = courseStats[courseId];
        if (stats?.lessonMap) {
            const title = stats.lessonMap[String(lessonId)] || "Lesson";
            lessonTitleCache.current[cacheKey] = title;
            return title;
        }
        return "Lesson";
    };

    const loadCourseStats = async (courseId, forceRefresh = false) => {
        if (courseStats[courseId] && !forceRefresh) return;
        if (loadingStats[courseId]) return;

        setLoadingStats(prev => ({ ...prev, [courseId]: true }));

        try {
            let courseData = courseStats[courseId]?.courseData;

            if (!courseData || forceRefresh) {
                try {
                    if (currentCourse?._id === courseId) {
                        courseData = currentCourse;
                    } else {
                        const res = await getCourseById(courseId);
                        courseData = res.data;
                    }
                } catch (err) {
                    console.error("Failed to fetch course:", err);
                    if (!courseData) courseData = null;
                }
            }

            const [quizRes, assignmentRes] = await Promise.all([
                getQuizStats(courseId).catch(err => {
                    console.error("Quiz stats error:", err);
                    return { data: { average: 0, totalQuizzes: 0, submissions: [] } };
                }),
                getAssignmentStats(courseId).catch(err => {
                    console.error("Assignment stats error:", err);
                    return { data: { average: 0, totalAssignments: 0, reviewedCount: 0, submissions: [] } };
                }),
            ]);

            const lessonMap = courseData ? createLessonMap(courseData) : {};

            setCourseStats(prev => ({
                ...prev,
                [courseId]: {
                    quizStats: quizRes.data,
                    assignmentStats: assignmentRes.data,
                    courseData: courseData,
                    lessonMap: lessonMap,
                },
            }));
        } catch (err) {
            console.error("Failed to load course stats:", err);
        } finally {
            setLoadingStats(prev => ({ ...prev, [courseId]: false }));
        }
    };

    const handleExpandCourse = (courseId) => {
        if (expandedCourse === courseId) {
            setExpandedCourse(null);
        } else {
            setExpandedCourse(courseId);
            loadCourseStats(courseId, false);
        }
    };

    const handleRefreshStats = (courseId) => {
        Object.keys(lessonTitleCache.current).forEach(key => {
            if (key.startsWith(`${courseId}_`)) {
                delete lessonTitleCache.current[key];
            }
        });
        setCourseStats(prev => {
            const newStats = { ...prev };
            delete newStats[courseId];
            return newStats;
        });
        loadCourseStats(courseId, true);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-4 space-y-4 lg:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold">My Courses</h1>
                <Link to="/courses" className="btn btn-outline btn-sm sm:btn-md w-full sm:w-auto">
                    Browse More Courses
                </Link>
            </div>

            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
            )}

            {safeEnrollments.length === 0 ? (
                <div className="card bg-base-200">
                    <div className="card-body text-center py-12">
                        <h2 className="card-title justify-center">No courses enrolled yet</h2>
                        <p className="text-base-content/70">
                            Start your learning journey by enrolling in a course
                        </p>
                        <Link to="/courses" className="btn btn-primary w-fit mx-auto mt-4">
                            Browse Courses
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {safeEnrollments.map((enrollment) => {
                        const courseId = enrollment.course?._id;
                        const isExpanded = expandedCourse === courseId;
                        const stats = courseStats[courseId];
                        const isLoading = loadingStats[courseId];

                        return (
                            <div
                                key={enrollment._id}
                                className="card bg-base-100 shadow-md border border-base-300"
                            >
                                <div className="card-body p-4 sm:p-6">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h2 className="card-title text-lg sm:text-xl break-words">
                                                {enrollment.course?.title || "Enrolled Course"}
                                            </h2>
                                            <p className="text-xs sm:text-sm text-base-content/70 mt-1">
                                                Instructor: {enrollment.course?.instructorName || "Instructor"}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => handleExpandCourse(courseId)}
                                                className="btn btn-sm btn-outline flex-1 sm:flex-none"
                                            >
                                                {isExpanded ? "Hide" : "Details"}
                                            </button>
                                            <Link
                                                to={`/courses/${courseId}/player`}
                                                className="btn btn-sm btn-primary flex-1 sm:flex-none"
                                            >
                                                Continue
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mt-4 p-4 bg-base-200 rounded-lg">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <p className="text-sm font-semibold text-base-content/80">Course Progress</p>
                                                <p className="text-xs text-base-content/70 mt-1">
                                                    {enrollment.progress?.completedLessons?.length || 0} lessons completed
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl sm:text-3xl font-bold text-primary">
                                                    {enrollment.progress?.percent || 0}%
                                                </p>
                                            </div>
                                        </div>
                                        <progress
                                            className="progress progress-primary w-full h-4"
                                            value={enrollment.progress?.percent || 0}
                                            max="100"
                                        ></progress>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="mt-6 space-y-4 border-t border-base-300 pt-4">
                                            {isLoading ? (
                                                <div className="flex justify-center py-8">
                                                    <span className="loading loading-spinner"></span>
                                                </div>
                                            ) : stats ? (
                                                <>
                                                    <div className="flex justify-end mb-2">
                                                        <button
                                                            onClick={() => handleRefreshStats(courseId)}
                                                            disabled={isLoading}
                                                            className="btn btn-sm btn-outline btn-circle"
                                                            title="Refresh Stats"
                                                        >
                                                            🔄
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                                        <div className="card bg-primary text-primary-content">
                                                            <div className="card-body p-3 sm:p-4">
                                                                <h3 className="text-xs sm:text-sm font-semibold opacity-80">Quiz Average</h3>
                                                                <p className="text-2xl sm:text-3xl font-bold">
                                                                    {stats.quizStats?.average || 0}%
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="card bg-secondary text-secondary-content">
                                                            <div className="card-body p-3 sm:p-4">
                                                                <h3 className="text-xs sm:text-sm font-semibold opacity-80">Assignment Average</h3>
                                                                <p className="text-2xl sm:text-3xl font-bold">
                                                                    {stats.assignmentStats?.average || 0}%
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="card bg-accent text-accent-content">
                                                            <div className="card-body p-3 sm:p-4">
                                                                <h3 className="text-xs sm:text-sm font-semibold opacity-80">Overall Grade</h3>
                                                                <p className="text-2xl sm:text-3xl font-bold">
                                                                    {Math.round(((stats.quizStats?.average || 0) + (stats.assignmentStats?.average || 0)) / 2)}%
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-4 text-base-content/70">
                                                    Click "Details" to load statistics
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}