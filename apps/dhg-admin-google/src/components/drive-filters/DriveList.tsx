import React, { useState } from 'react';

interface Drive {
  id: string;
  profile_id: string;
  root_drive_id: string;
  include_children: boolean;
  created_at: string;
}

interface DriveListProps {
  profileId: string;
  drives: Drive[];
  onAddDrives: (profileId: string, driveIds: string[]) => void;
  onRemoveDrives: (profileId: string, driveIds: string[]) => void;
}

export const DriveList: React.FC<DriveListProps> = ({
  profileId,
  drives,
  onAddDrives,
  onRemoveDrives,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newDriveId, setNewDriveId] = useState('');
  const [selectedDrives, setSelectedDrives] = useState<Set<string>>(new Set());

  const handleAddDrive = async () => {
    if (!newDriveId.trim()) return;

    await onAddDrives(profileId, [newDriveId.trim()]);
    setNewDriveId('');
    setIsAdding(false);
  };

  const handleRemoveSelected = async () => {
    if (selectedDrives.size === 0) return;

    const driveIds = Array.from(selectedDrives);
    await onRemoveDrives(profileId, driveIds);
    setSelectedDrives(new Set());
  };

  const toggleDriveSelection = (driveId: string) => {
    const newSelection = new Set(selectedDrives);
    if (newSelection.has(driveId)) {
      newSelection.delete(driveId);
    } else {
      newSelection.add(driveId);
    }
    setSelectedDrives(newSelection);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          {drives.length} drive{drives.length !== 1 ? 's' : ''} associated with this profile
        </div>
        <div className="flex gap-2">
          {selectedDrives.size > 0 && (
            <button
              onClick={handleRemoveSelected}
              className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded hover:bg-red-50"
            >
              Remove Selected ({selectedDrives.size})
            </button>
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            Add Drive
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Google Drive Folder ID
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDriveId}
              onChange={(e) => setNewDriveId(e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., 1ABC123DEF456..."
              autoFocus
            />
            <button
              onClick={handleAddDrive}
              disabled={!newDriveId.trim()}
              className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewDriveId('');
              }}
              className="bg-gray-200 text-gray-800 px-4 py-1 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Enter the Google Drive folder ID from the folder's URL
          </p>
        </div>
      )}

      {drives.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedDrives.size === drives.length && drives.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDrives(new Set(drives.map(d => d.root_drive_id)));
                      } else {
                        setSelectedDrives(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Drive ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Include Children
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {drives.map((drive) => (
                <tr key={drive.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedDrives.has(drive.root_drive_id)}
                      onChange={() => toggleDriveSelection(drive.root_drive_id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {drive.root_drive_id}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                    {drive.include_children ? 'Yes' : 'No'}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(drive.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
          No drives added to this profile yet
        </div>
      )}
    </div>
  );
};