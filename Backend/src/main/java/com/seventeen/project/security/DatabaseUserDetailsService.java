package com.seventeen.project.security;

import com.seventeen.project.repository.UserRepository;

import org.springframework.security.core.userdetails.*;
//import org.springframework.stereotype.Service;


public class DatabaseUserDetailsService
        implements UserDetailsService {

    private final UserRepository users;

    public DatabaseUserDetailsService(
            UserRepository users
    ) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) {

        var user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new UsernameNotFoundException(
                                "User not found"
                        )
                );

        return User.withUsername(user.getEmail())
                .password(user.getPassword())
                .authorities(
                        "ROLE_" + user.getRole().name()
                )
                .disabled(!user.isEnabled())
                .build();
    }
}
