import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  let httpsOptions = undefined;
  
  // Vérifier si les certificats SSL existent
  const certPath = '/app/certs/cert.pem';
  const keyPath = '/app/certs/key.pem';
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    console.log('SSL certificates loaded, HTTPS enabled');
  } else {
    console.log('SSL certificates not found, running in HTTP mode');
  }

  const app = await NestFactory.create(AppModule, { httpsOptions });
  app.enableCors({
    origin: '*',
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is listening on ${httpsOptions ? 'https' : 'http'}://localhost:${port}`);
}
bootstrap();
