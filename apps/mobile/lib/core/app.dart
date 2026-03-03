import 'package:flutter/material.dart';

class WhispApp extends StatelessWidget {
  const WhispApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WHISP',
      theme: ThemeData(colorSchemeSeed: const Color(0xFF0B6E4F)),
      home: const Scaffold(
        body: Center(child: Text('WHISP Phase 1 Scaffold')),
      ),
    );
  }
}
