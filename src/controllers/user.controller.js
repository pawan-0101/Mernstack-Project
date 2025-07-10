import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError}from "../utils/apiError.js"
import {User}from "../models/user.model.js"
import { uploadOnCloud } from "../utils/Cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
const registerUser = asyncHandler ( async (req,res)=>{
    //  res.status(200).json({
    //     message:"OK"
    // })

    //get user details from frontend
    //validation-not empty
    //check if user not already exist;name, email
    //check for images,avatar
    //upload them to cloudinary-lso avatar
    //create user object and entry in db
    //remove password and refresh token and check for user creation
    //return res
    const {fullName,email,username,password}=req.body
    console.log("email: ",email);
    if(
        [fullName,email,username,password].some((i)=> i ?.trim()==="")
    ){
         throw new apiError(400,"All fields are required")
    }

    const existeduser=User.findOne({
        $or:[{username},{email}]
    })
    if(existeduser)
    {
        throw new apiError(409,"User with email or username already exists")
    }
    const avatarLocalpath=req.files?.avatar[0]?.path;
    const coverImageLocalpath=req.files?.coverImage[0]?.path;
    if(!avatarLocalpath){
        throw new apiError(400,"Avatar file is required");
    }
    //upload on cloudinay
    const avatar=await uploadOnCloud(avatarLocalpath)
     const coverImage=await uploadOnCloud(coverImageLocalpath)
    if(!avatar){
        throw new apiError(400,"Avatar file is required");
    }

    const user=await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email,
        password,
        username: username.toLowerCase()
    })
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new apiError(500,"Something went wrong while register");    
    }
    return res.status(201).json(
        new apiResponse(200,createdUser,"User register successful")
    )

})

export {
    registerUser,
}