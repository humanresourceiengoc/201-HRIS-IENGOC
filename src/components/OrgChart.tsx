import React, { useState } from 'react';
import { CompanyKey, Employee, UserRole } from '../types';
import { Users, Search, FolderTree, Award, Printer, ChevronDown, Check, LayoutGrid, Network } from 'lucide-react';

interface OrgChartProps {
  company: CompanyKey;
  userRole?: UserRole;
  employees: Employee[];
  onViewEmployee: (emp: Employee) => void;
  onUpdateEmployee?: (emp: Employee) => void;
}

export const OrgChart: React.FC<OrgChartProps> = ({
  company,
  userRole = 'admin',
  employees,
  onViewEmployee,
  onUpdateEmployee
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [hideResigned, setHideResigned] = useState<boolean>(true);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [customTierInput, setCustomTierInput] = useState<string>('');
  const [viewMode, setViewMode] = useState<'classic-tree' | 'pill-tree' | 'grid'>('classic-tree');

  const companyName = company === 'seb' ? 'SEB Equipment DB' : 'IENCC 201 Database';

  // Extract unique departments & categories
  const empList = Array.isArray(employees) ? employees : [];
  const departments = ['ALL', ...Array.from(new Set(empList.map(e => e?.department || 'General Staff'))).sort()];
  const categories = ['ALL', ...Array.from(new Set(empList.map(e => e?.classification || e?.employmentType || 'Regular'))).sort()];

  // Filter employees
  const filteredEmployees = empList.filter(emp => {
    if (!emp) return false;
    // Hide resigned / separated / AWOL employees if hideResigned is true
    if (hideResigned && (emp.status === 'RESIGNED' || emp.status === 'SEPARATED' || emp.status === 'AWOL' || emp.status === 'INACTIVE')) {
      return false;
    }

    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.position} ${emp.empId} ${emp.orgLevel || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || (emp.department || 'General Staff') === selectedDept;
    const matchesCategory = selectedCategory === 'ALL' || (emp.classification || emp.employmentType || 'Regular') === selectedCategory;
    return matchesSearch && matchesDept && matchesCategory;
  });

  // Organize by explicit orgLevel first, then default to position matching
  const getEmployeeLevel = (e: Employee): string => {
    if (e.orgLevel) return e.orgLevel;
    const pos = (e.position || '').toLowerCase();
    if (pos.includes('ceo') || pos.includes('director') || pos.includes('president') || pos.includes('head') || e.classification === 'Executive') {
      return '1 - Executive Leadership';
    }
    if (pos.includes('manager') || pos.includes('supervisor') || pos.includes('lead') || e.classification === 'Supervisory') {
      return '2 - Managers & Supervisors';
    }
    if (pos.includes('senior') || pos.includes('officer') || pos.includes('specialist')) {
      return '3 - Senior Specialists & Leads';
    }
    return '4 - Rank & File Staff';
  };

  // Group employees by level
  const levelGroups: Record<string, Employee[]> = {};
  (filteredEmployees || []).forEach(emp => {
    if (!emp) return;
    const lvl = getEmployeeLevel(emp);
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(emp);
  });

  const sortedLevels = Object.keys(levelGroups).sort();

  const handleLevelChange = (emp: Employee, newLevel: string) => {
    if (onUpdateEmployee) {
      onUpdateEmployee({
        ...emp,
        orgLevel: newLevel
      });
    }
    setEditingEmpId(null);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Render SlideEgg-style Pill Card
  const renderPillCard = (emp: Employee, levelIdx: number, isExec = false) => {
    // Color palettes matching SlideEgg org chart theme
    let bgClass = 'bg-[#009FB7] hover:bg-[#00899f] text-white'; // Cyan
    let borderClass = 'border-[#008398]';
    let subTextColor = 'text-cyan-100';

    if (levelIdx === 0 || isExec) {
      // Executive / CEO (Dark Teal)
      bgClass = 'bg-[#0D4B59] hover:bg-[#0a3c47] text-white';
      borderClass = 'border-[#08333c] shadow-lg scale-105';
      subTextColor = 'text-teal-200';
    } else if (levelIdx === 1) {
      // Direct Reports (Teal Blue)
      bgClass = 'bg-[#0B7B8E] hover:bg-[#096a7a] text-white';
      borderClass = 'border-[#085b6a]';
      subTextColor = 'text-teal-100';
    } else if (levelIdx === 2) {
      // Managers (Charcoal Slate)
      bgClass = 'bg-[#2D3748] hover:bg-[#232b38] text-white';
      borderClass = 'border-[#1a202c]';
      subTextColor = 'text-slate-300';
    } else if (levelIdx === 3) {
      // Team Leaders / Specialists (Bright Cyan)
      bgClass = 'bg-[#009FB7] hover:bg-[#00899f] text-white';
      borderClass = 'border-[#007b8e]';
      subTextColor = 'text-cyan-100';
    }

    return (
      <div
        key={emp.id}
        className={`rounded-full p-1.5 pr-5 flex items-center gap-3 border ${bgClass} ${borderClass} transition-all shadow-md hover:shadow-xl cursor-pointer group min-w-[210px] max-w-[270px] relative`}
        onClick={() => onViewEmployee(emp)}
      >
        {/* Connector Dot Top */}
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-teal-500 border-2 border-white shadow-xs pointer-events-none" />

        {/* Circular Avatar Frame on Left */}
        <div className="w-12 h-12 rounded-full border-2 border-white bg-slate-100 text-slate-800 font-extrabold text-sm flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
          {emp.photoUrl ? (
            <img
              src={emp.photoUrl}
              alt={`${emp.firstName} ${emp.lastName}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : (
            <span>{getInitials(emp.firstName, emp.lastName)}</span>
          )}
        </div>

        {/* Info on Right */}
        <div className="min-w-0 flex-1 text-left leading-tight">
          <h4 className="font-extrabold text-xs text-white truncate">
            {emp.firstName} {emp.lastName}
          </h4>
          <p className={`text-[11px] font-semibold truncate ${subTextColor}`}>
            {emp.position || 'Staff'}
          </p>
          <span className="text-[9px] font-mono text-white/70 block truncate">
            {emp.department || 'Dept'}
          </span>
        </div>

        {/* Quick Tier Edit Button */}
        {onUpdateEmployee && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingEmpId(editingEmpId === emp.id ? null : emp.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/20 hover:bg-white/40 text-white rounded-full text-[10px]"
              title="Change Tier Level"
            >
              ⚙️
            </button>

            {editingEmpId === emp.id && (
              <div
                className="absolute right-0 top-8 z-50 bg-white text-slate-900 p-3 rounded-2xl shadow-2xl border border-slate-200 min-w-[240px]"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Set Org Tier Level:</label>
                <select
                  autoFocus
                  value={getEmployeeLevel(emp)}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setCustomTierInput('');
                    } else {
                      handleLevelChange(emp, e.target.value);
                    }
                  }}
                  className="w-full p-2 border border-blue-500 rounded-xl text-xs font-bold outline-none bg-slate-50 mb-2"
                >
                  <option value="1 - Executive Leadership">1 - Executive Leadership</option>
                  <option value="2 - Managers & Supervisors">2 - Managers & Supervisors</option>
                  <option value="3 - Senior Specialists & Leads">3 - Senior Specialists & Leads</option>
                  <option value="4 - Rank & File Staff">4 - Rank & File Staff</option>
                  <option value="5 - Consultants & Advisory">5 - Consultants & Advisory</option>
                  <option value="6 - Field & Project Workers">6 - Field & Project Workers</option>
                  <option value="Custom">Custom Tier Level</option>
                  <option value="custom">✏️ Enter Custom Tier Level...</option>
                </select>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {['Custom Tier Level', 'Project Lead', 'Consultant'].map(cTag => (
                      <button
                        key={cTag}
                        type="button"
                        onClick={() => {
                          handleLevelChange(emp, cTag);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 rounded text-[10px] font-semibold"
                      >
                        + {cTag}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customTierInput}
                    onChange={(e) => setCustomTierInput(e.target.value)}
                    placeholder="e.g. 7 - Regional Leads, Custom..."
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customTierInput.trim()) {
                        handleLevelChange(emp, customTierInput.trim());
                        setCustomTierInput('');
                      }
                    }}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Save Custom Tier
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderClassicTreeCard = (emp: Employee, levelIdx: number, isExec: boolean) => {
    const roleTitle = emp.position || (isExec ? 'Executive Officer' : 'Department Staff');
    const fullName = `${emp.firstName} ${emp.lastName}${emp.suffix ? ' ' + emp.suffix : ''}`;
    
    // Choose banner color based on position level matching screenshot
    const posLower = (emp.position || '').toLowerCase();
    let bannerBg = 'bg-indigo-600 text-white';
    if (posLower.includes('president') || posLower.includes('ceo') || isExec) {
      bannerBg = 'bg-blue-950 text-white';
    } else if (posLower.includes('vp') || posLower.includes('vice') || posLower.includes('director')) {
      bannerBg = 'bg-cyan-600 text-white';
    } else if (posLower.includes('manager') || posLower.includes('supervisor') || posLower.includes('lead')) {
      bannerBg = 'bg-lime-600 text-white';
    }

    return (
      <div
        key={emp.id}
        onClick={() => onViewEmployee(emp)}
        className="w-72 bg-white rounded-2xl border border-slate-300 shadow-md hover:shadow-xl transition-all cursor-pointer overflow-hidden flex flex-col group relative"
      >
        {/* Top Role Title Banner (Matching User Screenshot) */}
        <div className={`px-4 py-2 font-extrabold text-xs tracking-wider uppercase flex items-center justify-between ${bannerBg}`}>
          <span className="truncate">{roleTitle}</span>
          <span className="text-[10px] opacity-80 font-mono">{emp.empId}</span>
        </div>

        {/* Box Body */}
        <div className="p-3 flex items-center gap-3">
          {/* Avatar on Left */}
          <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center font-black text-xs text-slate-700 shadow-2xs">
            {emp.photoUrl ? (
              <img
                src={emp.photoUrl}
                alt={fullName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <span>{getInitials(emp.firstName, emp.lastName)}</span>
            )}
          </div>

          {/* Details on Right */}
          <div className="min-w-0 flex-1 leading-tight">
            <h4 className="font-extrabold text-xs text-slate-900 truncate">
              {fullName}
            </h4>
            <p className="text-[11px] font-bold text-teal-700 truncate mt-0.5">
              {emp.department || 'General Staff'}
            </p>
            <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-medium">
              📱 {emp.mobileNumber || emp.companyEmail || emp.employeeNumber || 'No Contact'}
            </span>
          </div>
        </div>

        {/* Tree Connector Node Indicator */}
        <div className="w-full flex justify-center -mb-2 z-10">
          <span className="w-4 h-4 rounded-full bg-white border border-slate-400 text-slate-600 text-[9px] font-black flex items-center justify-center shadow-xs">
            -
          </span>
        </div>
      </div>
    );
  };

  const handlePrintOrgChart = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Print Org Chart error:', e);
      window.print();
    }
  };

  return (
    <div className="space-y-6 org-chart-printable">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-blue-600" />
            Company Organizational Chart
          </h2>
          <p className="text-xs text-slate-500">
            Hierarchical view of personnel, department supervisors, and staff for {companyName}. Click any employee to view their 201 file.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('classic-tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'classic-tree' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5 text-blue-800" />
              <span>Classic Hierarchy Tree</span>
            </button>
            <button
              onClick={() => setViewMode('pill-tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'pill-tree' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-teal-600" />
              <span>SlideEgg Pill Tree</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span>Grid View</span>
            </button>
          </div>

          <button
            onClick={handlePrintOrgChart}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Org Chart
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, position, tier..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Category / Type Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories / Types</option>
              {categories.filter(c => c !== 'ALL').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Hide Resigned Checkbox Toggle */}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors select-none">
            <input
              type="checkbox"
              checked={hideResigned}
              onChange={(e) => setHideResigned(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded-md border-slate-300 focus:ring-teal-500"
            />
            <span>Hide Resigned Staff</span>
          </label>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">Department:</span>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDept === dept
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Organizational Hierarchy Display */}
      {sortedLevels.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200">
          No active staff members match the selected filter criteria.
        </div>
      ) : viewMode === 'classic-tree' ? (
        /* Classic Hierarchy Tree Layout (Matching Uploaded Image) */
        <div className="bg-slate-100/80 p-8 rounded-3xl border border-slate-200 shadow-inner overflow-x-auto">
          <div className="min-w-[700px] flex flex-col items-center gap-8 relative">
            {sortedLevels.map((lvl, levelIdx) => {
              const groupEmps = levelGroups[lvl] || [];
              const isExec = lvl.includes('1 -') || lvl.toLowerCase().includes('executive');

              return (
                <div key={lvl} className="w-full flex flex-col items-center gap-3 relative">
                  {/* Connecting Vertical Line from Parent Level */}
                  {levelIdx > 0 && (
                    <div className="w-0.5 h-10 bg-slate-400 relative">
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-600" />
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-600" />
                    </div>
                  )}

                  {/* Level Header Badge */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-xs">
                    {isExec ? <Award className="w-3.5 h-3.5 text-amber-400" /> : <Users className="w-3.5 h-3.5 text-slate-300" />}
                    <span>{lvl}</span>
                    <span className="bg-slate-700 px-1.5 py-0.2 rounded-full font-mono text-[9px] text-slate-200">{groupEmps.length}</span>
                  </div>

                  {/* Horizontal Connector Line between Siblings */}
                  {groupEmps.length > 1 && (
                    <div className="w-3/4 max-w-5xl h-0.5 bg-slate-400 relative my-1">
                      <span className="absolute left-0 -top-1 w-2.5 h-2.5 rounded-full bg-slate-600" />
                      <span className="absolute right-0 -top-1 w-2.5 h-2.5 rounded-full bg-slate-600" />
                    </div>
                  )}

                  {/* Classic Card Row */}
                  <div className="flex flex-wrap items-center justify-center gap-6 max-w-7xl">
                    {groupEmps.map(emp => renderClassicTreeCard(emp, levelIdx, isExec))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'pill-tree' ? (
        /* SlideEgg Style Org Chart Tree Layout */
        <div className="bg-slate-50/70 p-8 rounded-3xl border border-slate-200 shadow-inner overflow-x-auto">
          <div className="min-w-[700px] flex flex-col items-center gap-10 relative">
            {sortedLevels.map((lvl, levelIdx) => {
              const groupEmps = levelGroups[lvl] || [];
              const isExec = lvl.includes('1 -') || lvl.toLowerCase().includes('executive');

              return (
                <div key={lvl} className="w-full flex flex-col items-center gap-3 relative">
                  {/* Connecting Line from Level Above */}
                  {levelIdx > 0 && (
                    <div className="w-0.5 h-8 bg-teal-600/40 relative">
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-teal-600" />
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-teal-600" />
                    </div>
                  )}

                  {/* Level Header Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                    {isExec ? <Award className="w-3.5 h-3.5 text-teal-700" /> : <Users className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{lvl}</span>
                    <span className="bg-slate-300 px-1.5 py-0.2 rounded-full font-mono text-[9px]">{groupEmps.length}</span>
                  </div>

                  {/* Horizontal Tree Connecting Line for Multiple Children */}
                  {groupEmps.length > 1 && (
                    <div className="w-3/4 max-w-4xl h-0.5 bg-teal-600/30 relative my-1">
                      <span className="absolute left-0 -top-1 w-2.5 h-2.5 rounded-full bg-teal-600" />
                      <span className="absolute right-0 -top-1 w-2.5 h-2.5 rounded-full bg-teal-600" />
                    </div>
                  )}

                  {/* Pill Cards Row */}
                  <div className="flex flex-wrap items-center justify-center gap-4 max-w-6xl">
                    {groupEmps.map(emp => renderPillCard(emp, levelIdx, isExec))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="space-y-8 pb-10">
          {sortedLevels.map(lvl => {
            const groupEmps = levelGroups[lvl] || [];
            const isExec = lvl.includes('1 -') || lvl.toLowerCase().includes('executive');

            return (
              <div key={lvl} className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    {isExec ? <Award className="w-4 h-4 text-teal-600" /> : <Users className="w-4 h-4 text-slate-600" />}
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                      {lvl} ({groupEmps.length})
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {companyName}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupEmps.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => onViewEmployee(emp)}
                      className={`p-4 rounded-2xl border transition-all shadow-2xs hover:shadow-md flex items-center gap-3.5 cursor-pointer ${
                        isExec
                          ? 'bg-slate-900 text-white border-slate-700'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-teal-400'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center font-extrabold text-xs">
                        {emp.photoUrl ? (
                          <img
                            src={emp.photoUrl}
                            alt={`${emp.firstName} ${emp.lastName}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span>{getInitials(emp.firstName, emp.lastName)}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs truncate">
                          {emp.lastName}, {emp.firstName}
                        </h4>
                        <p className={`text-xs font-semibold truncate ${isExec ? 'text-teal-300' : 'text-teal-700'}`}>
                          {emp.position || 'Employee'}
                        </p>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {emp.department || 'General Staff'} • {emp.empId}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
