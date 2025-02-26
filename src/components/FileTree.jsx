import React from 'react';

function FileTree({ data, onNodeSelect, selectedNodeId }) {
  // Recursive rendering of tree nodes
  const renderTreeNodes = (nodes) => {
    return nodes.map((node) => (
      <div key={node.id} className="ml-2">
        <div 
          className={`py-1 px-2 my-1 rounded cursor-pointer ${
            selectedNodeId === node.id 
              ? 'bg-blue-100 text-blue-800 font-medium' 
              : 'hover:bg-gray-100'
          }`}
          onClick={() => onNodeSelect(node)}
        >
          {node.type === 'expert' ? (
            <span className="font-medium">{node.name}</span>
          ) : (
            <span>{node.name}</span>
          )}
        </div>
        
        {node.children && node.children.length > 0 && (
          <div className="border-l-2 border-gray-200 pl-2">
            {renderTreeNodes(node.children)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      {data.length === 0 ? (
        <p className="text-gray-500">No documents found</p>
      ) : (
        renderTreeNodes(data)
      )}
    </div>
  );
}

export default FileTree; 