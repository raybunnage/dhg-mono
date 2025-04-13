import { functionRegistry } from '../function-registry';

functionRegistry.register('handleFileSelection', {
  description: 'Handles file selection and multi-select in FileTree',
  status: 'active',
  location: 'src/components/FileTree.tsx',
  category: 'UI_INTERACTION',
  dependencies: [],
  usedIn: ['FileTree'],
  targetPackage: 'ui-components'
}); 