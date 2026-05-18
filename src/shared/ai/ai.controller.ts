import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TEXT_MODEL_OPTIONS, MODEL_PRICING } from './model-pricing';
import { AiService } from './ai.service';
import { AiPreviewDto } from './dto/preview.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Get('models')
  models() {
    return {
      text: TEXT_MODEL_OPTIONS.map((id) => ({
        id,
        pricing: MODEL_PRICING[id] ?? null,
      })),
    };
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: AiPreviewDto) {
    return this.ai.runChat({
      model: dto.model,
      systemPrompt: dto.systemPrompt ?? '',
      userPrompt: dto.userPrompt,
      variables: dto.variables ?? {},
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      siteId: dto.siteId,
      promptTemplateId: dto.promptTemplateId,
      useCache: dto.useCache,
    });
  }
}
