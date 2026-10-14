import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const fastifyStatus = exception && typeof exception === "object" && "statusCode" in exception ? Number(exception.statusCode) : 0;
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : Number.isInteger(fastifyStatus) && fastifyStatus >= 400 && fastifyStatus <= 599 ? fastifyStatus : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) request.log.error({ err: exception, requestId: request.id }, "Request failed");
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const details = response && typeof response === "object" ? response as { code?: unknown; reason?: unknown } : {};
    const message = typeof response === "string"
      ? response
      : response && typeof response === "object" && "message" in response
        ? response.message
        : status === HttpStatus.INTERNAL_SERVER_ERROR
          ? "Internal server error"
          : exception instanceof Error ? exception.message : "Request failed";

    reply.status(status).send({
      statusCode: status,
      message,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof details.code === "string" ? { code: details.code } : {}),
      ...(typeof details.reason === "string" ? { reason: details.reason } : {}),
    });
  }
}
