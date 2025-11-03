import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Users,
  GraduationCap,
  BookOpen,
  Award,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const PrincipalDashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 1247,
    totalTeachers: 89,
    totalSubjects: 45,
    activeExams: 12,
    passRate: 87.5,
    attendanceRate: 92.3,
    newAdmissions: 156,
    graduatingStudents: 203,
  });

  const [upcomingExams, setUpcomingExams] = useState([
    {
      id: 1,
      subject: "Mathematics",
      grade: "Grade 10",
      date: "2025-11-02",
      time: "09:00 AM",
      duration: "2 hours",
      students: 298,
      status: "scheduled",
    },
    {
      id: 2,
      subject: "Physics",
      grade: "Grade 12",
      date: "2025-11-03",
      time: "10:30 AM",
      duration: "3 hours",
      students: 175,
      status: "scheduled",
    },
    {
      id: 3,
      subject: "English Literature",
      grade: "Grade 11",
      date: "2025-11-05",
      time: "02:00 PM",
      duration: "2.5 hours",
      students: 145,
      status: "pending",
    },
    {
      id: 4,
      subject: "Computer Science",
      grade: "Grade 12",
      date: "2025-11-07",
      time: "11:00 AM",
      duration: "2 hours",
      students: 120,
      status: "scheduled",
    },
  ]);

  const [weeklyAttendance, setWeeklyAttendance] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    datasets: [
      {
        label: "Students",
        data: [95, 92, 88, 94, 89, 85],
        borderColor: "rgba(34, 197, 94, 1)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        tension: 0.4,
      },
      {
        label: "Teachers",
        data: [98, 96, 94, 97, 95, 88],
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
      },
    ],
  });

  const [performanceData, setPerformanceData] = useState({
    labels: [
      "Math",
      "Science",
      "English",
      "History",
      "Computer Science",
      "Physics",
    ],
    datasets: [
      {
        label: "Average Scores",
        data: [78, 82, 75, 80, 88, 85],
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1,
      },
    ],
  });

  const [enrollmentData, setEnrollmentData] = useState({
    labels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
    datasets: [
      {
        data: [312, 298, 287, 350],
        backgroundColor: [
          "rgba(239, 68, 68, 0.8)",
          "rgba(245, 158, 11, 0.8)",
          "rgba(34, 197, 94, 0.8)",
          "rgba(168, 85, 247, 0.8)",
        ],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
      },
    },
  };

  const StatCard = ({
    icon: Icon,
    title,
    value,
    change,
    trend,
    color = "blue",
  }) => {
    const colorClasses = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      orange: "bg-orange-500",
      purple: "bg-purple-500",
      red: "bg-red-500",
      indigo: "bg-indigo-500",
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`${colorClasses[color]} p-3 rounded-lg text-white`}>
              <Icon size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-600 text-sm font-medium">{title}</h3>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
          {change && (
            <div
              className={`flex items-center ${
                trend === "up" ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend === "up" ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span className="ml-1 text-sm font-medium">{change}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const UpcomingExams = () => {
    const getStatusBadge = (status) => {
      const statusConfig = {
        scheduled: { color: "bg-green-100 text-green-800", text: "Scheduled" },
        pending: { color: "bg-yellow-100 text-yellow-800", text: "Pending" },
        completed: { color: "bg-blue-100 text-blue-800", text: "Completed" },
      };

      const config = statusConfig[status] || statusConfig.pending;

      return (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {config.text}
        </span>
      );
    };

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Upcoming Exams
          </h3>
          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View All
          </button>
        </div>

        <div className="space-y-4">
          {upcomingExams.map((exam) => (
            <div
              key={exam.id}
              className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{exam.subject}</h4>
                  {getStatusBadge(exam.status)}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">Grade:</span> {exam.grade}
                  </p>
                  <p>
                    <span className="font-medium">Date:</span>{" "}
                    {formatDate(exam.date)} at {exam.time}
                  </p>
                  <p>
                    <span className="font-medium">Duration:</span>{" "}
                    {exam.duration}
                  </p>
                </div>
              </div>
              <div className="ml-4 text-right">
                <p className="text-sm font-medium text-gray-900">
                  {exam.students}
                </p>
                <p className="text-xs text-gray-500">Students</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const RecentActivity = () => {
    const activities = [
      {
        type: "exam",
        message: "Math Exam completed by Grade 10",
        time: "2 hours ago",
        status: "completed",
      },
      {
        type: "admission",
        message: "New student admission approved",
        time: "4 hours ago",
        status: "success",
      },
      {
        type: "alert",
        message: "Low attendance in Computer Science",
        time: "6 hours ago",
        status: "warning",
      },
      {
        type: "exam",
        message: "Physics Exam scheduled for tomorrow",
        time: "1 day ago",
        status: "pending",
      },
      {
        type: "event",
        message: "Parent-Teacher meeting scheduled",
        time: "2 days ago",
        status: "info",
      },
    ];

    const getStatusIcon = (status) => {
      switch (status) {
        case "completed":
        case "success":
          return <CheckCircle className="text-green-500" size={16} />;
        case "warning":
          return <AlertCircle className="text-yellow-500" size={16} />;
        case "pending":
          return <Clock className="text-blue-500" size={16} />;
        default:
          return <FileText className="text-gray-500" size={16} />;
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activities
        </h3>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50"
            >
              {getStatusIcon(activity.status)}
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Principal Dashboard
        </h1>
        <p className="text-gray-600 mt-2">
          Comprehensive overview of institutional performance and statistics
        </p>
      </div>

      {/* Key Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Students"
          value={stats.totalStudents.toLocaleString()}
          change="5.2"
          trend="up"
          color="blue"
        />
        <StatCard
          icon={GraduationCap}
          title="Total Teachers"
          value={stats.totalTeachers}
          change="2.1"
          trend="up"
          color="green"
        />
        <StatCard
          icon={BookOpen}
          title="Active Subjects"
          value={stats.totalSubjects}
          color="orange"
        />
        <StatCard
          icon={Award}
          title="Active Exams"
          value={stats.activeExams}
          change="1.5"
          trend="down"
          color="purple"
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Subject Performance Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Subject Performance
          </h3>
          <Bar data={performanceData} options={chartOptions} />
        </div>

        {/* Student Enrollment Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Student Enrollment by Grade
          </h3>
          <Doughnut data={enrollmentData} options={doughnutOptions} />
        </div>
      </div>

      {/* Weekly Attendance and Upcoming Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Important Announcements */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Important Announcements
          </h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
              <div className="flex items-center">
                <AlertCircle className="text-blue-500 mr-2" size={16} />
                <h4 className="font-medium text-blue-900">
                  Mid-term Exam Schedule Released
                </h4>
              </div>
              <p className="text-blue-800 text-sm mt-1">
                Mid-term examination schedule for all grades has been published.
                Please check the exam portal.
              </p>
              <p className="text-blue-600 text-xs mt-2">Posted 3 hours ago</p>
            </div>

            <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
              <div className="flex items-center">
                <CheckCircle className="text-green-500 mr-2" size={16} />
                <h4 className="font-medium text-green-900">
                  New Lab Equipment Installed
                </h4>
              </div>
              <p className="text-green-800 text-sm mt-1">
                Advanced computer lab equipment has been successfully installed
                and is ready for use.
              </p>
              <p className="text-green-600 text-xs mt-2">Posted 1 day ago</p>
            </div>

            <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg">
              <div className="flex items-center">
                <Calendar className="text-orange-500 mr-2" size={16} />
                <h4 className="font-medium text-orange-900">
                  Parent-Teacher Conference
                </h4>
              </div>
              <p className="text-orange-800 text-sm mt-1">
                Annual parent-teacher conference scheduled for next week. RSVP
                required.
              </p>
              <p className="text-orange-600 text-xs mt-2">Posted 2 days ago</p>
            </div>
          </div>
        </div>

        {/* Upcoming Exams */}
        <UpcomingExams />
      </div>

      {/* Recent Activities and Important Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
            <Users className="mr-2" size={20} />
            Manage Students
          </button>
          <button className="flex items-center justify-center p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <GraduationCap className="mr-2" size={20} />
            View Teachers
          </button>
          <button className="flex items-center justify-center p-4 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors">
            <FileText className="mr-2" size={20} />
            Generate Reports
          </button>
          <button className="flex items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
            <Award className="mr-2" size={20} />
            Exam Management
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrincipalDashboard;
