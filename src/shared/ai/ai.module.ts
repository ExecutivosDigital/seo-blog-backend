import { Global, Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ImageGenerationService } from './image-generation.service';
import { OpenRouterClient } from './openrouter.client';
import { PromptEngineService } from './prompt-engine.service';

@Global()
@Module({
  controllers: [AiController],
  providers: [OpenRouterClient, PromptEngineService, AiService, ImageGenerationService],
  exports: [OpenRouterClient, PromptEngineService, AiService, ImageGenerationService],
})
export class AiModule {}
