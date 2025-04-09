import React, { useState, useEffect } from 'react';
import './App.css';

interface SearchResult {
  type: 'key' | 'value';
  path: string;
  value: string;
  parentObj: any;
  childrenObj: any;
  priority: number;
}

function App() {
  const [jsonInput, setJsonInput] = useState('');
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  
  // Reference for search result elements
  const searchResultRefs = React.useRef<Record<string, HTMLElement | null>>({});

  // Process JSON when input changes
  useEffect(() => {
    if (!jsonInput.trim()) {
      setParsedJson(null);
      setError('');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      setParsedJson(parsed);
      setError('');
    } catch (err: any) {
      setParsedJson(null);
      setError(`Invalid JSON: ${err.message}`);
    }
  }, [jsonInput]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim() || !parsedJson) {
      setSearchResults([]);
      return;
    }

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    const getValueAtPath = (obj: any, path: string) => {
      if (!path) return obj;
      const parts = path.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
      }
      return current;
    };

    const getParent = (obj: any, path: string) => {
      if (!path || !path.includes('.')) return { parent: null, key: path };
      const parts = path.split('.');
      const key = parts.pop();
      const parentPath = parts.join('.');
      return { parent: getValueAtPath(obj, parentPath), key };
    };

    const searchInObject = (obj: any, path = '') => {
      if (!obj || typeof obj !== 'object') return;

      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key;

        // Search in keys
        const matchesQuery = key.toLowerCase().includes(query);

        if (matchesQuery) {
          const { parent } = getParent(parsedJson, currentPath);
          results.push({
            type: 'key',
            path: currentPath,
            value: key,
            parentObj: parent,
            childrenObj: value,
            priority: key.toLowerCase() === query ? 5 : 1
          });
        }

        // Search in values
        if (typeof value === 'string' && value.toLowerCase().includes(query)) {
          const { parent } = getParent(parsedJson, currentPath);
          results.push({
            type: 'value',
            path: currentPath,
            value: value,
            parentObj: parent,
            childrenObj: null,
            priority: value === query ? 5 : 1
          });
        }

        // Recursively search in nested objects
        if (value && typeof value === 'object') {
          searchInObject(value, currentPath);
        }
      });
    };

    searchInObject(parsedJson);
    results.sort((a, b) => b.priority - a.priority);
    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, parsedJson]);

  const toggleSection = (path: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Get parent path from a path string
  const getParentPath = (path: string): string | null => {
    const lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex === -1) return null; // No parent
    return path.substring(0, lastDotIndex);
  };

  // Get a normalized pattern from a path
  const getNormalizedPattern = (path: string): string => {
    if (!path) return '';
    
    // Split the path into parts
    const parts = path.split('.');
    
    // Replace all numeric indices with wildcards to match any index in the same array
    const patternParts = parts.map(part => /^\d+$/.test(part) ? '*' : part);
    
    return patternParts.join('.');
  };

  // Find all sibling array items for a given path
  const findSiblingArrayItems = (path: string): string[] => {
    if (!path) return [];
    
    // Get all parts of the path
    const parts = path.split('.');
    
    // Find index parts (numeric)
    const indexPositions: number[] = [];
    parts.forEach((part, index) => {
      if (/^\d+$/.test(part)) {
        indexPositions.push(index);
      }
    });
    
    // If there are no array indices, there are no siblings
    if (indexPositions.length === 0) return [];
    
    // Find siblings by looking for paths with same pattern but different array indices
    const currentPattern = getNormalizedPattern(path);
    
    return Object.keys(expandedSections).filter(p => {
      if (p === path) return false; // Skip the current path
      
      // Compare patterns
      const pattern = getNormalizedPattern(p);
      if (pattern !== currentPattern) return false;
      
      // Check if all non-index parts match
      const pParts = p.split('.');
      if (pParts.length !== parts.length) return false;
      
      // Make sure all non-index parts match exactly
      for (let i = 0; i < parts.length; i++) {
        // Skip index positions
        if (indexPositions.includes(i)) continue;
        
        // Non-index parts must match
        if (parts[i] !== pParts[i]) return false;
      }
      
      return true;
    });
  };

  // Find all paths with similar structure to the given path
  const findSimilarStructurePaths = (path: string): string[] => {
    if (!path) return [];
    
    console.log(`Finding similar paths for: ${path}`);
    
    // Find sibling array items
    const siblings = findSiblingArrayItems(path);
    console.log(`Found ${siblings.length} sibling paths`);
    
    return siblings;
  };

  // Finds the path up to a particular array index
  const getPathUpToIndex = (path: string, indexPosition: number): string => {
    const parts = path.split('.');
    return parts.slice(0, indexPosition).join('.');
  };
  
  // Get path with the array index replaced
  const getPathWithReplacedIndex = (path: string, indexPosition: number, newIndex: number): string => {
    const parts = path.split('.');
    const prefix = parts.slice(0, indexPosition).join('.');
    const suffix = parts.slice(indexPosition + 1).join('.');
    const newIndexStr = newIndex.toString();
    return prefix ? 
      (suffix ? `${prefix}.${newIndexStr}.${suffix}` : `${prefix}.${newIndexStr}`) : 
      (suffix ? `${newIndexStr}.${suffix}` : newIndexStr);
  };
  
  // Find siblings in an array
  const findSiblingsInArray = (path: string): string[] => {
    // Get the path parts
    const parts = path.split('.');
    
    // Find first array index position
    let indexPosition = -1;
    for (let i = 0; i < parts.length; i++) {
      if (/^\d+$/.test(parts[i])) {
        indexPosition = i;
        break;
      }
    }
    
    if (indexPosition === -1) return []; // No array index found
    
    // Get the array parent path
    const arrayParentPath = getPathUpToIndex(path, indexPosition);
    
    // Get the array at this path
    const getValueAtPath = (obj: any, path: string) => {
      if (!path) return obj;
      const pathParts = path.split('.');
      let current = obj;
      for (const part of pathParts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
      }
      return current;
    };
    
    const arrayAtPath = getValueAtPath(parsedJson, arrayParentPath);
    
    if (!Array.isArray(arrayAtPath)) return [];
    
    // Generate all possible paths by replacing the index
    const siblingsWithoutCurrent = [];
    const currentIndex = parseInt(parts[indexPosition], 10);
    
    for (let i = 0; i < arrayAtPath.length; i++) {
      if (i !== currentIndex) { // Skip the current index
        siblingsWithoutCurrent.push(getPathWithReplacedIndex(path, indexPosition, i));
      }
    }
    
    return siblingsWithoutCurrent;
  };
  
  // Expand all parent paths of a given path
  const ensureParentPathsExpanded = (path: string, updates: Record<string, boolean>) => {
    const parts = path.split('.');
    
    // Build up parent paths and ensure they are all expanded
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += (currentPath ? '.' : '') + parts[i];
      updates[currentPath] = true;
    }
  };

  // Find siblings at all levels of nesting
  const findNestedSiblings = (path: string): string[] => {
    const parts = path.split('.');
    let allSiblings: string[] = [];
    
    // Find all positions of array indices
    const indexPositions: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (/^\d+$/.test(parts[i])) {
        indexPositions.push(i);
      }
    }
    
    if (indexPositions.length === 0) return [];
    
    // For each array index, find siblings at that level
    // Start with the closest to root (most likely to affect the most nodes)
    indexPositions.forEach(pos => {
      // Get the path up to this array index
      const pathToHere = parts.slice(0, pos + 1).join('.');
      // Find siblings at this level
      const siblings = findSiblingsInArray(pathToHere);
      
      // For each sibling, add the remaining path parts
      if (pos < parts.length - 1) {
        const suffixParts = parts.slice(pos + 1);
        const suffix = suffixParts.join('.');
        siblings.forEach(sibling => {
          allSiblings.push(`${sibling}.${suffix}`);
        });
      } else {
        allSiblings = [...allSiblings, ...siblings];
      }
    });
    
    return Array.from(new Set(allSiblings)); // Remove duplicates
  };

  // Toggle all items with similar structure to the same state (open or closed)
  const toggleSimilarStructures = (path: string, expand: boolean) => {
    // Find all sibling paths at all levels of nesting
    const nestedSiblings = findNestedSiblings(path);
    console.log(`Found ${nestedSiblings.length} nested siblings for ${path}`);
    
    if (nestedSiblings.length === 0) {
      // Fallback to pattern-based search if direct sibling lookup fails
      const similarPaths = findSimilarStructurePaths(path);
      console.log(`Using pattern match instead, found ${similarPaths.length} similar paths`);
      
      if (similarPaths.length === 0) {
        console.log(`No similar paths found for ${path}`);
        return; // Don't do anything if no similar paths found
      }
      
      // Create an object with the updates
      const updates: Record<string, boolean> = {};
      
      // For 'Open Similar', include current path. For 'Close Similar', exclude it
      if (expand) {
        updates[path] = expand;
        
        // Ensure all parent paths are expanded
        ensureParentPathsExpanded(path, updates);
      }
      
      // Add all similar structure paths to the updates
      similarPaths.forEach(p => {
        updates[p] = expand;
        
        // If expanding, also expand all parent paths
        if (expand) {
          ensureParentPathsExpanded(p, updates);
        }
      });
      
      // Update the expanded sections state
      setExpandedSections(prev => ({
        ...prev,
        ...updates
      }));
      
      console.log(`Toggling ${similarPaths.length} similar paths to ${expand ? 'expanded' : 'collapsed'}`);
    } else {
      // Create an object with the updates
      const updates: Record<string, boolean> = {};
      
      // For 'Open Similar', include current path. For 'Close Similar', exclude it
      if (expand) {
        updates[path] = expand;
        
        // Ensure all parent paths are expanded
        ensureParentPathsExpanded(path, updates);
      }
      
      // Add all sibling paths to the updates
      nestedSiblings.forEach(p => {
        updates[p] = expand;
        
        // If expanding, also expand all parent paths
        if (expand) {
          ensureParentPathsExpanded(p, updates);
        }
      });
      
      // Update the expanded sections state
      setExpandedSections(prev => ({
        ...prev,
        ...updates
      }));
      
      console.log(`Toggling ${nestedSiblings.length} nested siblings to ${expand ? 'expanded' : 'collapsed'}`);
    }
  };

  // Helper function to expand all parent paths of a search result
  const expandParentPaths = (path: string) => {
    if (!path) return;
    
    const parts = path.split('.');
    let currentPath = '';
    const updates: Record<string, boolean> = {};
    
    // Expand each parent path
    for (let i = 0; i < parts.length; i++) {
      currentPath += (currentPath ? '.' : '') + parts[i];
      updates[currentPath] = true;
    }
    
    setExpandedSections(prev => ({
      ...prev,
      ...updates
    }));
  };
  
  // Effect to handle navigation through search results
  useEffect(() => {
    if (currentSearchIndex >= 0 && searchResults.length > 0) {
      const result = searchResults[currentSearchIndex];
      
      // Expand all parent paths to make the result visible
      expandParentPaths(result.path);
      
      // Wait a bit for the DOM to update after expanding
      setTimeout(() => {
        const element = searchResultRefs.current[result.path];
        if (element) {
          // Scroll the element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add a highlight effect
          element.classList.add('search-highlight');
          setTimeout(() => element.classList.remove('search-highlight'), 2000);
        }
      }, 100);
    }
  }, [currentSearchIndex, searchResults]);

  const navigateToNextResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => (prev + 1) % searchResults.length);
  };

  const navigateToPrevResult = () => {
    if (searchResults.length === 0) return;
    setCurrentSearchIndex(prev => 
      prev <= 0 ? searchResults.length - 1 : prev - 1
    );
  };

  const renderValue = (value: any): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (typeof value === 'boolean') {
      return <span className="text-purple-600">{value.toString()}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-blue-600">{value}</span>;
    }
    if (typeof value === 'string') {
      // String rendering is now handled directly in the JSON rendering component
      // to allow for selective highlighting of content without quotes
      return <span className="text-green-600">"{value}"</span>;
    }
    return String(value);
  };

  const renderJSON = (obj: any, path = '', level = 0): React.ReactNode => {
    if (obj === null) return <span className="text-gray-500">null</span>;
    if (typeof obj !== 'object') {
      return <>{renderValue(obj)}</>;
    }

    return (
      <div className="json-viewer-container">
        {Object.entries(obj).map(([key, value]: [string, any]): React.ReactNode => {
          const currentPath = path ? `${path}.${key}` : key;
          const isObject = value && typeof value === 'object';
          const hasSimilarItems = findSimilarStructurePaths(currentPath).length > 0;
          const allSimilarExpanded = hasSimilarItems && findSimilarStructurePaths(currentPath).every((p: string) => expandedSections[p]);

          return (
            <div key={currentPath} className="json-item mb-1">
              <div className="json-toggle">
                {isObject && (
                  <button
                    onClick={() => toggleSection(currentPath)}
                  >
                    {expandedSections[currentPath] ? '▼' : '▶'}
                  </button>
                )}
              </div>
              <div className="json-key-value">
                <div className="json-key">
                  <span 
                    ref={el => {
                      // Store reference to this element if it's a key search result
                      const isKeyMatch = searchResults.some(r => 
                        r.type === 'key' && r.path === currentPath && r.value === key
                      );
                      if (isKeyMatch && el) {
                        searchResultRefs.current[currentPath] = el;
                      }
                    }}
                    className={`highlight-name ${searchResults.some(r => 
                      r.type === 'key' && 
                      r.path === currentPath && 
                      r.value === key && 
                      searchResults.indexOf(r) === currentSearchIndex
                    ) ? 'search-result-current' : ''}`}
                  >{key}</span>
                  <span className="mx-1">:</span>
                  {isObject ? (
                    <>
                      {!expandedSections[currentPath] ? (
                        <button 
                          className="text-gray-500 ml-1"
                          onClick={() => toggleSection(currentPath)}
                        >
                          {Array.isArray(value) ? '[...]' : '{...}'}
                        </button>
                      ) : (
                        // Always show the similar button for expanded objects
                        <button
                          className="similar-toggle"
                          onClick={() => toggleSimilarStructures(currentPath, !allSimilarExpanded)}
                        >
                          {allSimilarExpanded ? 'Close Similar' : 'Open Similar'}
                        </button>
                      )}
                    </>
                  ) : (
                    typeof value === 'string' ? (
                      <span className="ml-1 text-green-600">
                        <span className="quote">"</span>
                        <span 
                          ref={el => {
                            // Store reference to this element if it's a value search result
                            const isValueMatch = searchResults.some(r => 
                              r.type === 'value' && r.path === currentPath && r.value === value
                            );
                            if (isValueMatch && el) {
                              searchResultRefs.current[currentPath] = el;
                            }
                          }}
                          className={`${searchResults.some(r => 
                            r.type === 'value' && 
                            r.path === currentPath && 
                            r.value === value && 
                            searchResults.indexOf(r) === currentSearchIndex
                          ) ? 'search-result-current' : ''}`}
                        >
                          {value}
                        </span>
                        <span className="quote">"</span>
                      </span>
                    ) : (
                      <span className="ml-1">{renderValue(value)}</span>
                    )
                  )}
                </div>
                {isObject && expandedSections[currentPath] && (
                  <div className="json-children">
                    {renderJSON(value, currentPath, level + 1)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`p-4 min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">JSON Exploration Tool</h1>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className={`px-3 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
        >
          {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
        </button>
      </div>

      <div className={`mb-4 p-3 rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <textarea
          className={`w-full h-48 p-2 font-mono text-sm rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'}`}
          placeholder="Paste your JSON here..."
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {parsedJson && (
        <div className={`mb-4 p-3 rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="flex items-center mb-2">
            <input
              type="text"
              placeholder="Search keys and values..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`flex-grow p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'}`}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Found {searchResults.length} matches
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={navigateToPrevResult}
                    className={`px-3 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={navigateToNextResult}
                    className={`px-3 py-1 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
                  >
                    Next →
                  </button>
                </div>
              </div>

              {currentSearchIndex >= 0 && (
                <div className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <h3 className="font-bold mb-2">Match Details</h3>
                  <div className="mb-3">
                    <h4 className="font-semibold mb-1">Path:</h4>
                    <div className={`p-2 rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      {searchResults[currentSearchIndex].path}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {parsedJson && (
        <div className={`w-full p-4 font-mono rounded ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <h2 className="text-lg font-bold mb-2">Formatted JSON</h2>
          <div className="overflow-x-auto">
            {renderJSON(parsedJson)}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
