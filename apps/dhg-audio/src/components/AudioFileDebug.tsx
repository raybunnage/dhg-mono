import React from 'react';
import { AudioFile } from '@/services/audio-adapter';

interface AudioFileDebugProps {
  file: AudioFile;
  rawData?: any; // The raw data from the database query
}

export function AudioFileDebug({ file, rawData }: AudioFileDebugProps) {
  return (
    <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto">
      <details className="cursor-pointer">
        <summary className="font-semibold text-gray-700 hover:text-gray-900">
          Debug Info (click to expand)
        </summary>
        
        <div className="mt-2 space-y-2">
          {/* Basic file info */}
          <div className="bg-white p-2 rounded">
            <div className="font-semibold text-gray-700 mb-1">File Info:</div>
            <div>ID: {file.id}</div>
            <div>Drive ID: {file.driveId}</div>
            <div>Display Name: {file.name}</div>
            <div>Original filename: {rawData?.name || 'N/A'}</div>
          </div>

          {/* Expert info */}
          <div className="bg-white p-2 rounded">
            <div className="font-semibold text-gray-700 mb-1">Expert Info:</div>
            {file.expert ? (
              <>
                <div>Expert ID: {file.expert.id}</div>
                <div>Expert Name: {file.expert.name}</div>
                <div>Expert Full Name: {file.expert.fullName}</div>
              </>
            ) : (
              <div className="text-red-600">No expert found</div>
            )}
          </div>

          {/* google_sources_experts raw data */}
          <div className="bg-white p-2 rounded">
            <div className="font-semibold text-gray-700 mb-1">google_sources_experts:</div>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(rawData?.google_sources_experts || null, null, 2)}
            </pre>
          </div>

          {/* google_expert_documents raw data */}
          <div className="bg-white p-2 rounded">
            <div className="font-semibold text-gray-700 mb-1">google_expert_documents:</div>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(rawData?.google_expert_documents || null, null, 2)}
            </pre>
            {rawData?.google_expert_documents?.length > 0 && (
              <div className="mt-1 text-green-600">
                Title found: {rawData.google_expert_documents[0].title || 'null'}
              </div>
            )}
          </div>

          {/* Associated video information */}
          <div className="bg-white p-2 rounded">
            <div className="font-semibold text-gray-700 mb-1">Associated Video (main_video_id):</div>
            {rawData?.main_video_id ? (
              <>
                <div className="text-green-600">✓ Video found!</div>
                <div>Main Video ID: {rawData.main_video_id}</div>
                <div>Video Name: {rawData.main_video_name || 'N/A'}</div>
                <div>Video Drive ID: {rawData.main_video_drive_id || 'N/A'}</div>
                <div>Video Title: <strong>{rawData.video_title || 'No title found'}</strong></div>
              </>
            ) : (
              <>
                <div className="text-red-600">✗ No associated video found</div>
                <div className="text-xs text-gray-500 mt-1">
                  Searched for MP4 file with base name: {rawData?.name?.replace(/\.(m4a|mp3)$/i, '')}.mp4
                </div>
              </>
            )}
            <div className="mt-2 text-xs text-gray-500">
              <div>Audio file path: {rawData?.path || 'N/A'}</div>
              <div>Parent folder ID: {rawData?.parent_folder_id || 'N/A'}</div>
            </div>
            {rawData?.main_video_id && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                <div className="font-semibold">media_presentations lookup:</div>
                <div>This main_video_id ({rawData.main_video_id}) can be used to find entries in media_presentations table</div>
              </div>
            )}
          </div>

          {/* Full raw data */}
          <div className="bg-white p-2 rounded">
            <div className="font-semibold text-gray-700 mb-1">Full Raw Data:</div>
            <pre className="text-xs overflow-x-auto max-h-60">
              {JSON.stringify(rawData, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}