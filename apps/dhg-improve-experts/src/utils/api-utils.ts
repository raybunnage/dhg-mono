import { Request, Response } from 'express';

/**
 * Type for a server API handler function
 */
export type ServerHandler = (req: Request, res: Response) => Promise<any>;

/**
 * Creates a server handler with error handling
 * This wraps API handler functions to provide consistent error handling
 */
export function createServerHandler(handler: ServerHandler): ServerHandler {
  return async (req: Request, res: Response) => {
    try {
      // Execute the handler
      return await handler(req, res);
    } catch (error) {
      // Log the error
      console.error('API Error:', error);
      
      // Return error response
      const statusCode = error.statusCode || 500;
      const errorMessage = error.message || 'Internal Server Error';
      
      // Avoid sending a response if one has already been sent
      if (!res.headersSent) {
        return res.status(statusCode).json({
          success: false,
          message: errorMessage
        });
      }
    }
  };
}