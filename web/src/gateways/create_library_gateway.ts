import { invoke } from '@tauri-apps/api/core';
import type { LibraryGateway } from './library_gateway';
import { MockLibraryGateway } from './mock_library_gateway';
import { TauriLibraryGateway } from './tauri_library_gateway';

export function createLibraryGateway(): LibraryGateway {
  if (import.meta.env.MODE === 'tauri') {
    return new TauriLibraryGateway((command, args) => invoke(command, args));
  }

  return new MockLibraryGateway();
}
