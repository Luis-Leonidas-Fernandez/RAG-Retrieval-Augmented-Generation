import mongoose from "mongoose";
import { body, param, validationResult } from "express-validator";
import { createResponse } from "../utils/response.js";

/**
 * Validar que un parámetro es un MongoDB ObjectId válido
 */
export const validateObjectId = (paramName = "id") => {
  return param(paramName).custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error(`El ${paramName} no es un ID válido`);
    }
    return true;
  });
};

/**
 * Validar que un campo del body es un MongoDB ObjectId válido
 */
export const validateObjectIdBody = (fieldName = "id") => {
  return body(fieldName)
    .notEmpty()
    .withMessage(`${fieldName} es requerido`)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`El ${fieldName} no es un ID válido`);
      }
      return true;
    });
};

/**
 * Validar y sanitizar strings
 */
export const validateString = (fieldName, options = {}) => {
  const {
    minLength = 1,
    maxLength = 10000,
    required = true,
    trim = true,
  } = options;

  let validator = body(fieldName);

  if (trim) {
    validator = validator.trim();
  }

  if (required) {
    validator = validator.notEmpty().withMessage(`${fieldName} es requerido`);
  }

  return validator
    .isLength({ min: minLength, max: maxLength })
    .withMessage(
      `${fieldName} debe tener entre ${minLength} y ${maxLength} caracteres`
    )
    .escape(); // Escapar HTML para prevenir XSS
};

/**
 * Middleware para manejar errores de validación
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json(
      createResponse(false, "Errores de validación", {
        errors: errors.array(),
      })
    );
  }
  
  next();
};

/**
 * Validación para parámetros de ID en rutas
 */
export const validateIdParam = (paramName = "id") => [
  validateObjectId(paramName),
  handleValidationErrors,
];

