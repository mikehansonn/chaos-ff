import React, { useState, useEffect, useRef } from 'react';

const FilterDropdown = ({ 
    positions,
    nameFilter,
    positionFilter,
    statusFilter,
    onNameFilterChange,
    onPositionFilterChange,
    onStatusFilterChange
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
  
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
  
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);
  
    const clearNameFilter = () => {
      onNameFilterChange({ target: { value: '' } });
    };
  
    const clearPositionFilter = () => {
      onPositionFilterChange('');
    };
  
    const clearStatusFilter = () => { 
      onStatusFilterChange(false); 
    };
  
    const getPositionStyles = (position) => {
      const styles = {
        QB: { bg: 'bg-red-100', text: 'text-red-800', activeBg: 'bg-red-200', hoverBg: 'hover:bg-red-50' },
        RB: { bg: 'bg-blue-100', text: 'text-blue-800', activeBg: 'bg-blue-200', hoverBg: 'hover:bg-blue-50' },
        WR: { bg: 'bg-green-100', text: 'text-green-800', activeBg: 'bg-green-200', hoverBg: 'hover:bg-green-50' },
        TE: { bg: 'bg-yellow-100', text: 'text-yellow-800', activeBg: 'bg-yellow-200', hoverBg: 'hover:bg-yellow-50' },
        DEF: { bg: 'bg-gray-100', text: 'text-gray-800', activeBg: 'bg-gray-200', hoverBg: 'hover:bg-gray-50' },
        K: { bg: 'bg-gray-100', text: 'text-gray-800', activeBg: 'bg-gray-200', hoverBg: 'hover:bg-gray-50' }
      };
  
      return styles[position] || { bg: 'bg-white', text: 'text-gray-700', activeBg: 'bg-gray-100', hoverBg: 'hover:bg-gray-50' };
    };
  
    return ( 
      <div className="relative flex justify-left items-center mb-2 h-auto" ref={dropdownRef}> 
          <div className="flex items-center gap-2"> 
              <button 
                  onClick={() => setIsOpen(!isOpen)} 
                  className="flex items-center justify-center w-12 lg:w-40 gap-2 ml-1 px-2 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50" 
              > 
                  <span className="material-symbols-outlined">filter_list</span> 
                  <span className='hidden lg:block'>Filters</span> 
              </button>
  
              {/* Active Filters Display */} 
              <div className="flex flex-col md:flex-row gap-2"> 
                  {nameFilter && ( 
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg"> 
                          <span className="text-sm truncate max-w-40">Name: {nameFilter}</span> 
                          <button 
                              onClick={clearNameFilter} 
                              className="flex items-center justify-center hover:bg-gray-100 p-0.5 rounded-full" 
                          > 
                              <span className="material-symbols-outlined">close</span> 
                          </button> 
                      </div> 
                  )}
  
                  {positionFilter && ( 
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg"> 
                          <span className="w-28 text-sm">Position: { 
                              <div className={`inline-block rounded-full px-3 py-1 ${getPositionStyles(positionFilter).bg} ${getPositionStyles(positionFilter).text}`}> 
                                  <div className="text-sm font-medium">{positionFilter}</div> 
                              </div>} 
                          </span> 
                          <button 
                              onClick={clearPositionFilter} 
                              className="flex items-center justify-center hover:bg-gray-100 p-0.5 rounded-full" 
                          > 
                              <span className="material-symbols-outlined">close</span> 
                          </button> 
                      </div> 
                  )}
  
                  {statusFilter && ( 
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 rounded-lg"> 
                          <span className="text-sm">Status: Only Available Players</span> 
                          <button 
                              onClick={clearStatusFilter} 
                              className="flex items-center justify-center hover:bg-gray-100 p-0.5 rounded-full" 
                          > 
                              <span className="material-symbols-outlined">close</span> 
                          </button> 
                      </div> 
                  )} 
              </div> 
          </div>
  
          {/* Filter Dropdown */} 
          {isOpen && ( 
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border rounded-lg shadow-lg p-4 z-10"> 
                  <div className="mb-4"> 
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1"> 
                          Player Name 
                      </label> 
                      <input 
                          type="text" 
                          id="name" 
                          value={nameFilter} 
                          onChange={onNameFilterChange} 
                          placeholder="Search players..." 
                          className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                          maxLength={32} 
                      /> 
                  </div>
  
                  <div className="mb-4"> 
                      <label className="block text-sm font-medium text-gray-700 mb-2"> 
                          Position 
                      </label> 
                      <div className="space-y-2"> 
                          {positions.map((position) => ( 
                              <label key={position.value} className="flex items-center"> 
                                  <input 
                                      type="radio" 
                                      name="position" 
                                      value={position.value} 
                                      checked={positionFilter === position.value} 
                                      onChange={() => onPositionFilterChange(position.value)} 
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" 
                                  /> 
                                  <div className={`ml-2 inline-block rounded-full px-3 py-1 ${getPositionStyles(position.label).bg} ${getPositionStyles(position.label).text}`}> 
                                      <div className="text-sm font-medium">{position.label}</div> 
                                  </div> 
                              </label> 
                          ))} 
                      </div> 
                  </div>
                  {statusFilter !== undefined && (
                    <div className="flex items-center justify-between"> 
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700"> 
                            Only Available Players 
                        </label> 
                        <label className="relative inline-flex items-center cursor-pointer"> 
                            <input 
                                type="checkbox" 
                                id="status" 
                                checked={statusFilter} 
                                onChange={(e) => onStatusFilterChange(e.target.checked)} 
                                className="sr-only peer" 
                            /> 
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div> 
                        </label> 
                    </div>
                  )}
              </div> 
          )} 
      </div> 
    ); 
  };

  export default FilterDropdown;