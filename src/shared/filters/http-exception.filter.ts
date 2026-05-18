import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ERROR_MESSAGES } from '../constants/error-messages';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = ERROR_MESSAGES.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message =
        typeof resp === 'string'
          ? resp
          : (resp as { message?: string | string[] })?.message
            ? Array.isArray((resp as { message: string[] }).message)
              ? (resp as { message: string[] }).message.join(', ')
              : (resp as { message: string }).message
            : exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = ERROR_MESSAGES.NOT_FOUND;
          break;
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = ERROR_MESSAGES.CONFLICT;
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = ERROR_MESSAGES.BAD_REQUEST;
          break;
        default:
          this.logger.error(`Unhandled Prisma error: ${exception.code}`, exception.stack);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: this.getErrorLabel(status),
      path: request.url,
    });
  }

  private getErrorLabel(status: number): string {
    const labels: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    };
    return labels[status] ?? 'Error';
  }
}
