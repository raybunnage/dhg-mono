import { functionRegistry } from './function-registry';

export function RegisterFunction(metadata: Omit<FunctionMetadata, 'name'>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    // Register the function
    functionRegistry[propertyKey] = {
      name: propertyKey,
      ...metadata
    };
    
    // Log registration in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Registered function: ${propertyKey}`, metadata);
    }

    return descriptor;
  };
} 