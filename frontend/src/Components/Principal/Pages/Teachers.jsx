import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Award,
  Calendar,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";

const Teachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Mock data for teachers
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setTeachers([
        {
          id: 1,
          name: "Dr. Sarah Johnson",
          email: "sarah.johnson@school.edu",
          phone: "+1 (555) 123-4567",
          department: "Mathematics",
          subjects: ["Algebra", "Calculus", "Geometry"],
          experience: "8 years",
          qualification: "PhD in Mathematics",
          joinDate: "2016-08-15",
          status: "active",
          avatar: null,
        },
        {
          id: 2,
          name: "Prof. Michael Chen",
          email: "michael.chen@school.edu",
          phone: "+1 (555) 234-5678",
          department: "Science",
          subjects: ["Physics", "Chemistry"],
          experience: "12 years",
          qualification: "MSc in Physics",
          joinDate: "2012-01-20",
          status: "active",
          avatar: null,
        },
        {
          id: 3,
          name: "Ms. Emily Davis",
          email: "emily.davis@school.edu",
          phone: "+1 (555) 345-6789",
          department: "English",
          subjects: ["Literature", "Grammar", "Creative Writing"],
          experience: "5 years",
          qualification: "MA in English Literature",
          joinDate: "2019-09-01",
          status: "active",
          avatar: null,
        },
        {
          id: 4,
          name: "Mr. Robert Wilson",
          email: "robert.wilson@school.edu",
          phone: "+1 (555) 456-7890",
          department: "Computer Science",
          subjects: ["Programming", "Database", "Web Development"],
          experience: "6 years",
          qualification: "MS in Computer Science",
          joinDate: "2018-03-10",
          status: "active",
          avatar: null,
        },
        {
          id: 5,
          name: "Dr. Lisa Martinez",
          email: "lisa.martinez@school.edu",
          phone: "+1 (555) 567-8901",
          department: "History",
          subjects: ["World History", "Ancient Civilizations"],
          experience: "10 years",
          qualification: "PhD in History",
          joinDate: "2014-07-25",
          status: "on_leave",
          avatar: null,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch = teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || teacher.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const departments = [...new Set(teachers.map(teacher => teacher.department))];

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', text: 'Active' },
      on_leave: { color: 'bg-yellow-100 text-yellow-800', text: 'On Leave' },
      inactive: { color: 'bg-red-100 text-red-800', text: 'Inactive' }
    };
    
    const config = statusConfig[status] || statusConfig.active;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const TeacherCard = ({ teacher }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <Users className="text-gray-600" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{teacher.name}</h3>
            <p className="text-sm text-gray-600">{teacher.department}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(teacher.status)}
          <button className="p-1 hover:bg-gray-100 rounded">
            <MoreVertical size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="mr-2" size={14} />
          {teacher.email}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="mr-2" size={14} />
          {teacher.phone}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Award className="mr-2" size={14} />
          {teacher.qualification}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="mr-2" size={14} />
          {teacher.experience} experience
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-700 mb-2">Subjects:</p>
        <div className="flex flex-wrap gap-1">
          {teacher.subjects.map((subject, index) => (
            <span key={index} className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded">
              {subject}
            </span>
          ))}
        </div>
      </div>

      <div className="flex space-x-2">
        <button className="flex-1 bg-gray-600 text-white py-2 px-3 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors flex items-center justify-center">
          <Eye size={14} className="mr-1" />
          View Profile
        </button>
        <button className="bg-gray-100 text-gray-700 py-2 px-3 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center">
          <Edit size={14} className="mr-1" />
          Edit
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Teachers</h1>
            <p className="text-gray-600 mt-1">Manage and view all teaching staff</p>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center"
          >
            <Plus className="mr-2" size={20} />
            Add Teacher
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-gray-500 p-3 rounded-lg text-white mr-4">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-gray-600 text-sm font-medium">Total Teachers</h3>
              <p className="text-2xl font-bold text-gray-900">{teachers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-green-500 p-3 rounded-lg text-white mr-4">
              <Award size={24} />
            </div>
            <div>
              <h3 className="text-gray-600 text-sm font-medium">Active Teachers</h3>
              <p className="text-2xl font-bold text-gray-900">
                {teachers.filter(t => t.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-orange-500 p-3 rounded-lg text-white mr-4">
              <MapPin size={24} />
            </div>
            <div>
              <h3 className="text-gray-600 text-sm font-medium">Departments</h3>
              <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-purple-500 p-3 rounded-lg text-white mr-4">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-gray-600 text-sm font-medium">On Leave</h3>
              <p className="text-2xl font-bold text-gray-900">
                {teachers.filter(t => t.status === 'on_leave').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search teachers by name, email, or department..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter size={20} className="text-gray-400" />
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Teachers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => (
          <TeacherCard key={teacher.id} teacher={teacher} />
        ))}
      </div>

      {filteredTeachers.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No teachers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}
    </div>
  );
};

export default Teachers;