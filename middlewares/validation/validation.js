const Joi = require('joi')



// login validation
const loginSchema = Joi.object().keys({
   email: Joi.string().trim().email({ minDomainAtoms: 2 }).required(),
   password: Joi.string().trim().alphanum().min(5).max(16).required()
})


// register validation
const registerSchema = Joi.object().keys({
   firstName: Joi.string().trim().min(3).max(30).required(),
   lastName: Joi.string().trim().min(3).max(30).required(),
   email: Joi.string().trim().email({ minDomainAtoms: 2 }).required(),
   password: Joi.string().trim().alphanum().min(5).max(16).required(),
   emailOffers: Joi.boolean()
})


// Product validation
const addProductSchema = Joi.object().keys({
   name: Joi.string().trim().min(3).max(30).required(),
   description: Joi.string().trim().min(3).max(800).required(),
   price: Joi.number().min(0).required(),
   inStock: Joi.boolean(),
   images: Joi.array().length(4).required()
})


const imageMimeTypeSchemas = Joi.object().keys({
   mimetype: Joi.string().trim().regex(/^image\/(jpg|jpeg)$/)
}) 



// exports
exports.registerValidation = (inputData) => Joi.assert(inputData, registerSchema)
exports.loginValidation = (inputData) => Joi.assert(inputData, loginSchema)
exports.addProductValidation = (inputData) => Joi.assert(inputData, addProductSchema)
exports.imageMimeTypesValidation = (image) => Joi.assert(image, imageMimeTypeSchemas)