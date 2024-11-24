import { Injectable, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import axios from 'axios'

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoordinates(city: string): Promise<{ lat: number, lon: number }> {
    const apiKey = 'b9a610582c3442fbba642136b0956e3d'
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${city}&key=${apiKey}`;

    try {
      const response = await axios.get(url);
      const result = response.data.results[0];
      if (result) {
        const { lat, lng } = result.geometry;
        return { lat, lon: lng };
      }
      throw new Error('Cidade não encontrada');
    } catch (error) {
      throw new Error('Erro ao buscar coordenadas');
    }
  }

  async register(data: {
    nome: string;
    gmail: string;
    senha: string;
    repetirSenha: string;
    cnpj: string;
    localizacao: string | { id: string };
  }) {
    const { nome, gmail, senha, repetirSenha, cnpj, localizacao } = data;

    if (senha !== repetirSenha) {
      throw new BadRequestException('As senhas não coincidem.');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { gmail } });
    if (existingUser) {
      throw new BadRequestException('O Gmail já está em uso.');
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{6,}$/
    if (!passwordRegex.test(senha)) {
      throw new BadRequestException('A senha deve conter ao menos 6 caracteres, incluindo letras, números e caracteres especiais.');
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    let localizacaoData;
    if (typeof localizacao === 'string') {
      const locationExists = await this.prisma.location.findFirst({
        where: { name: localizacao },
      });

      if (!locationExists) {
        const { lat, lon } = await this.getCoordinates(localizacao);
        localizacaoData = { 
          create: {
            name: localizacao, 
            lat: lat,
            lon: lon
          }
        };
      } else {
        localizacaoData = { connect: { id: locationExists.id } };
      }
    } else if (localizacao && localizacao.id) {
      const locationExists = await this.prisma.location.findUnique({
        where: { id: localizacao.id },
      });

      if (!locationExists) {
        throw new BadRequestException('Localização associada não encontrada.');
      }

      localizacaoData = { connect: { id: locationExists.id } };
    } else {
      throw new BadRequestException('Localização inválida.');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          nome,
          gmail,
          senha: hashedPassword,
          cnpj,
          localizacao: localizacaoData,
        },
      });

      return { message: 'Usuário cadastrado com sucesso!', user };
    } catch (error) {
      console.error('Erro ao cadastrar usuário:', error);
      throw new InternalServerErrorException('Erro ao cadastrar usuário. Tente novamente mais tarde.');
    }
  }

  async login(data: { gmail: string; senha: string }) {
    const { gmail, senha } = data;

    const user = await this.prisma.user.findUnique({ where: { gmail } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(senha, user.senha);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return { message: 'Login realizado com sucesso!', user };
  }

  async getAllLocalizations() {
    try {
      const locations = await this.prisma.location.findMany();
      return locations;
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
      throw new InternalServerErrorException('Erro ao buscar localizações.');
    }
  }

  async getUserLocation(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { localizacao: true },
      });

      if (!user || !user.localizacao) {
        throw new BadRequestException('Usuário ou localização não encontrados.');
      }

      return user.localizacao;
    } catch (error) {
      console.error('Erro ao buscar localização do usuário:', error);
      throw new InternalServerErrorException('Erro ao buscar localização do usuário.');
    }
  }
}
