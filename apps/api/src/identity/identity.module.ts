import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  controllers: [AccountsController, IdentityController],
  providers: [AccountsService, IdentityService],
  exports: [AccountsService, IdentityService],
})
export class IdentityModule {}
